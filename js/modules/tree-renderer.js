// js/modules/tree-renderer.js

import { findNodeById } from './data-utils.js';

export function renderGameTree(options) {
    const {
        gameTreeSvg,
        flatTreeData, // The comprehensive flat list of ALL nodes
        revealedNodes, // The Set of IDs that should be currently displayed
        revealedEdges, // Includes "direct-LCA_ID-SPECIES_ID" strings
        mysterySpecies,
        guessedSpeciesHistory,
        onNodeClick
    } = options;

    console.log("DEBUG: renderGameTree called.");
    console.log("DEBUG: revealedNodes passed to renderGameTree:", Array.from(revealedNodes));

    gameTreeSvg.innerHTML = ''; // Clear previous SVG content

    if (flatTreeData.length === 0) {
        gameTreeSvg.textContent = "Tree data not available.";
        console.warn("DEBUG: flatTreeData is empty in renderGameTree.");
        return;
    }

    // --- NEW LAYOUT LOGIC FOR SPARSE CLUSTERS ---

    // 1. Get actual node objects for layout, filtering out any nulls if findNodeById fails.
    const actualRevealedNodeObjects = Array.from(revealedNodes)
                                  .map(id => findNodeById(id, flatTreeData))
                                  .filter(Boolean);

    console.log("DEBUG: actualRevealedNodeObjects (IDs mapped to actual node objects, nulls filtered):", actualRevealedNodeObjects);
    console.log("DEBUG: actualRevealedNodeObjects.length:", actualRevealedNodeObjects.length);

    if (actualRevealedNodeObjects.length === 0) {
        gameTreeSvg.innerHTML = '';
        gameTreeSvg.style.height = `0px`;
        console.warn("DEBUG: renderGameTree: No valid node objects found for layout. Returning early.");
        return;
    }

    const svgWidth = gameTreeSvg.clientWidth;
    const nodeRadius = 15;
    const nodePadding = 30; // Space between nodes
    const clusterVerticalSpacing = 150; // Vertical space between different LCA clusters
    const branchLength = 100; // Length of the 'arms' from LCA to species

    const nodePositions = new Map(); // Map node ID to {x, y}
    let currentYOffset = nodePadding; // Tracks the current vertical position for placing clusters

    // --- CRITICAL CHANGE: 2. Identify unique LCA nodes directly from revealed objects ---
    // Instead of parsing edges, which might have issues with findNodeById,
    // let's find the LCA among the actualRevealedNodeObjects.
    const uniqueLCAIds = new Set(actualRevealedNodeObjects
                                .filter(node => node.type === 'family') // LCAs are family nodes
                                .map(node => node.id)); // Get their IDs

    console.log("DEBUG: Filtered Unique LCA IDs (identified from actualRevealedNodeObjects):", Array.from(uniqueLCAIds));
    // --- END CRITICAL CHANGE ---

    // 3. Layout each unique LCA cluster
    Array.from(uniqueLCAIds).sort().forEach(lcaId => { // Sort for consistent order
        const lcaNode = findNodeById(lcaId, flatTreeData); // This call should now reliably work as uniqueLCAIds are confirmed.

        // It should never be null here, but adding a check for robustness
        if (!lcaNode) {
             console.error(`DEBUG: Unexpected: LCA node ${lcaId} was in uniqueLCAIds but not found in flatTreeData.`);
             return; // Skip if somehow still null
        }

        const clusterChildren = []; // Nodes directly linked to this LCA (these will be guess/mystery species)
        revealedEdges.forEach(edgeId => {
            if (edgeId.startsWith('direct-')) {
                const parts = edgeId.split('-');
                if (parts[1] === lcaId) { // If this edge starts from our current LCA
                    const speciesNode = findNodeById(parts[2], flatTreeData); // Retrieve the actual species node object
                    if (speciesNode && revealedNodes.has(speciesNode.id)) { // Ensure child is also revealed
                        clusterChildren.push(speciesNode);
                    } else {
                        console.warn(`DEBUG: Child node ${parts[2]} for LCA ${lcaId} not found or not in revealedNodes. Skipping child.`);
                    }
                }
            }
        });

        const uniqueChildrenNodes = Array.from(new Set(clusterChildren.map(n => n.id)))
                                    .map(id => findNodeById(id, flatTreeData))
                                    .filter(Boolean); // Filter any nulls from children too

        // Calculate positions for this specific cluster
        const lcaX = svgWidth / 2; // Center LCA horizontally
        const lcaY = currentYOffset + branchLength; // Position LCA a bit down from current offset

        nodePositions.set(lcaNode.id, { x: lcaX, y: lcaY });

        // Position children in a line below the LCA, distributed horizontally
        const numChildren = uniqueChildrenNodes.length;
        if (numChildren > 0) {
            const childrenClusterWidth = numChildren * (nodeRadius * 2 + nodePadding);
            let currentChildX = (svgWidth - childrenClusterWidth) / 2 + nodeRadius;

            uniqueChildrenNodes.sort((a,b) => a.name.localeCompare(b.name)).forEach((childNode, index) => {
                const childX = currentChildX;
                const childY = lcaY + branchLength;
                nodePositions.set(childNode.id, { x: childX, y: childY });
                currentChildX += (nodeRadius * 2 + nodePadding);
            });
        }
        currentYOffset += (branchLength + nodeRadius * 2 + clusterVerticalSpacing);
    });

    const totalHeight = currentYOffset;

    gameTreeSvg.style.height = `${totalHeight}px`;
    gameTreeSvg.setAttribute('width', svgWidth);


    // 1. Draw "Direct Jump" Paths (from LCA to species, skipping intermediates)
    revealedEdges.forEach(edgeId => {
        if (edgeId.startsWith('direct-')) {
            const parts = edgeId.split('-');
            const lcaNodeId = parts[1];
            const speciesNodeId = parts[2];

            const lcaPos = nodePositions.get(lcaNodeId);
            const speciesPos = nodePositions.get(speciesNodeId);

            if (lcaPos && speciesPos) {
                const linkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                linkPath.setAttribute('d', `M${lcaPos.x},${lcaPos.y} L${speciesPos.x},${speciesPos.y}`);
                linkPath.classList.add('link-path');
                linkPath.classList.add('direct-link-path');
                gameTreeSvg.appendChild(linkPath);
            } else {
                console.warn(`DEBUG: Missing positions for edge ${edgeId}. LCA Pos found: ${!!lcaPos}, Species Pos found: ${!!speciesPos}`);
            }
        }
    });


    // 2. Draw Nodes (Circles or Rectangles) and Text
    // Iterate over revealedNodes (IDs), then look up the actual node object and its position
    revealedNodes.forEach(nodeId => {
        const node = findNodeById(nodeId, flatTreeData);
        const pos = nodePositions.get(nodeId);

        if (node && pos) {
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
        } else {
            console.warn(`DEBUG: Skipping drawing node ${nodeId}. Node object: ${!!node}, Position: ${!!pos}`);
        }
    });
}
