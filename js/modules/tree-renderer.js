// js/modules/tree-renderer.js

import { findNodeById } from './data-utils.js';

export function renderGameTree(options) {
    const {
        gameTreeSvg,
        flatTreeData,
        revealedNodes,
        revealedEdges, // Now includes "direct-LCA_ID-SPECIES_ID" strings
        mysterySpecies,
        guessedSpeciesHistory,
        onNodeClick
    } = options;

    console.log("DEBUG: renderGameTree called."); // NEW LOG
    console.log("DEBUG: revealedNodes passed to renderGameTree:", Array.from(revealedNodes)); // NEW LOG

    gameTreeSvg.innerHTML = '';

    if (flatTreeData.length === 0) {
        gameTreeSvg.textContent = "Tree data not available.";
        return;
    }

    // --- NEW LAYOUT LOGIC FOR SPARSE CLUSTERS ---
    // The goal is to lay out multiple "star" clusters (LCA + its direct species)
    // without implying a full hierarchical tree structure from the root.

    // Filter revealedNodes to get actual node objects. Filter out any nulls if findNodeById fails.
    const nodesForLayout = Array.from(revealedNodes).map(id => findNodeById(id, flatTreeData)).filter(Boolean);

    console.log("DEBUG: nodesForLayout (IDs mapped to actual node objects, nulls filtered):", nodesForLayout); // NEW LOG
    console.log("DEBUG: nodesForLayout.length:", nodesForLayout.length); // NEW LOG

    if (nodesForLayout.length === 0) {
        gameTreeSvg.innerHTML = '';
        gameTreeSvg.style.height = `0px`;
        console.warn("DEBUG: renderGameTree: No valid nodes for layout. Returning early."); // NEW LOG
        return;
    }

    const svgWidth = gameTreeSvg.clientWidth;
    const nodeRadius = 15;
    const nodePadding = 30; // Space between nodes
    const clusterVerticalSpacing = 150; // Vertical space between different LCA clusters
    const branchLength = 100; // Length of the 'arms' from LCA to species

    const nodePositions = new Map(); // Map node ID to {x, y}
    let currentYOffset = nodePadding; // Tracks the current vertical position for placing clusters

    // Identify unique LCA nodes that are currently revealed
    const uniqueLCAIds = new Set();
    revealedEdges.forEach(edgeId => {
        if (edgeId.startsWith('direct-')) {
            const parts = edgeId.split('-');
            uniqueLCAIds.add(parts[1]); // The LCA ID is the second part
        }
    });

    // Layout each unique LCA cluster
    Array.from(uniqueLCAIds).sort().forEach(lcaId => { // Sort for consistent order
        const lcaNode = findNodeById(lcaId, flatTreeData);
        if (!lcaNode) {
            console.warn(`DEBUG: LCA node ${lcaId} not found in flatTreeData for layout.`);
            return;
        }

        const clusterChildren = []; // Nodes directly linked to this LCA (guess/mystery species)
        revealedEdges.forEach(edgeId => {
            if (edgeId.startsWith('direct-')) {
                const parts = edgeId.split('-');
                if (parts[1] === lcaId) { // This edge starts from our current LCA
                    const speciesNode = findNodeById(parts[2], flatTreeData);
                    if (speciesNode && revealedNodes.has(speciesNode.id)) { // Ensure child is also revealed
                        clusterChildren.push(speciesNode);
                    }
                }
            }
        });

        const uniqueChildrenNodes = Array.from(new Set(clusterChildren.map(n => n.id)))
                                    .map(id => findNodeById(id, flatTreeData));

        // Calculate positions for this cluster
        const lcaX = svgWidth / 2; // Center LCA horizontally for now
        const lcaY = currentYOffset + branchLength; // Position LCA a bit down from current offset

        nodePositions.set(lcaNode.id, { x: lcaX, y: lcaY });

        // Position children in a line below the LCA, distributed horizontally
        const numChildren = uniqueChildrenNodes.length;
        if (numChildren > 0) {
            const childrenClusterWidth = numChildren * (nodeRadius * 2 + nodePadding);
            let currentChildX = (svgWidth - childrenClusterWidth) / 2 + nodeRadius; // Center the children block

            uniqueChildrenNodes.sort((a,b) => a.name.localeCompare(b.name)).forEach((childNode, index) => {
                const childX = currentChildX;
                const childY = lcaY + branchLength; // Position children below LCA
                nodePositions.set(childNode.id, { x: childX, y: childY });
                currentChildX += (nodeRadius * 2 + nodePadding);
            });
        }
        currentYOffset += (branchLength + nodeRadius * 2 + clusterVerticalSpacing); // Advance Y for next cluster
    });

    const totalHeight = currentYOffset; // Final height for SVG

    gameTreeSvg.style.height = `${totalHeight}px`;
    gameTreeSvg.setAttribute('width', svgWidth);


    // 1. Draw "Direct Jump" Paths (from LCA to species, skipping intermediates)
    revealedEdges.forEach(edgeId => {
        if (edgeId.startsWith('direct-')) {
            const parts = edgeId.split('-'); // e.g., ["direct", "LCA_ID", "SPECIES_ID"]
            const lcaNodeId = parts[1];
            const speciesNodeId = parts[2];

            const lcaPos = nodePositions.get(lcaNodeId);
            const speciesPos = nodePositions.get(speciesNodeId);

            if (lcaPos && speciesPos) {
                const linkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                linkPath.setAttribute('d', `M${lcaPos.x},${lcaPos.y} L${speciesPos.x},${speciesPos.y}`); // Direct straight line
                linkPath.classList.add('link-path');
                linkPath.classList.add('direct-link-path'); // Add a specific class for styling these direct links
                gameTreeSvg.appendChild(linkPath);
            }
        }
    });


    // 2. Draw Nodes (Circles or Rectangles) and Text
    revealedNodes.forEach(nodeId => { // Iterate over revealedNodes (not nodesForLayout) to draw all of them
        const node = findNodeById(nodeId, flatTreeData);
        const pos = nodePositions.get(nodeId);

        if (node && pos) { // Only draw if node data and position exist
            const isMystery = (mysterySpecies && node.id === mysterySpecies.id);
            const isGuessed = guessedSpeciesHistory.includes(node.id);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.classList.add('node-group');
            g.setAttribute('data-node-id', node.id);

            g.addEventListener('click', (event) => {
                event.stopPropagation();
                if (onNodeClick) {
                    onNodeClick(node);
                }
            });

            let shape;
            let nodeNameDisplay = node.name;

            if (node.type === 'family') {
                shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                shape.setAttribute('r', nodeRadius);
                shape.setAttribute('cx', pos.x);
                shape.setAttribute('cy', pos.y);
                shape.classList.add('node-circle');
            } else { // Species
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                const tempTextContent = (isMystery && !isGuessed) ? '???' : node.name;
                const textWidthEstimate = tempTextContent.length * 6 + 10;
                const rectWidth = Math.max(nodeRadius * 2.5, textWidthEstimate);
                const rectHeight = nodeRadius * 2;
                shape.setAttribute('x', pos.x - rectWidth / 2);
                shape.setAttribute('y', pos.y - rectHeight / 2);
                shape.setAttribute('width', rectWidth);
                shape.setAttribute('height', rectHeight);
                shape.setAttribute('rx', 5);
                shape.setAttribute('ry', 5);
                shape.classList.add('node-rect');

                if (isMystery && !isGuessed) {
                    nodeNameDisplay = '???';
                }
            }

            if (isMystery) {
                g.classList.add('mystery-node');
            }
            if (isGuessed) {
                g.classList.add('guessed-node');
            }
            if (!g.classList.contains('mystery-node') && !g.classList.contains('guessed-node')) {
                 g.classList.add('revealed-node');
            }

            g.appendChild(shape);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y + 4);
            text.classList.add('node-text');
            text.textContent = nodeNameDisplay;
            g.appendChild(text);

            gameTreeSvg.appendChild(g);
        }
    });
}
