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
    const nodesForLayout = Array.from(revealedNodes)
                                  .map(id => findNodeById(id, flatTreeData))
                                  .filter(Boolean); // Filters out null/undefined results

    console.log("DEBUG: nodesForLayout (IDs mapped to actual node objects, nulls filtered):", nodesForLayout);
    console.log("DEBUG: nodesForLayout.length:", nodesForLayout.length);

    if (nodesForLayout.length === 0) {
        gameTreeSvg.innerHTML = '';
        gameTreeSvg.style.height = `0px`;
        console.warn("DEBUG: renderGameTree: No valid nodes for layout. Returning early.");
        return;
    }

    const svgWidth = gameTreeSvg.clientWidth;
    const nodeRadius = 15;
    const nodePadding = 30; // Space between nodes
    const clusterVerticalSpacing = 150; // Vertical space between different LCA clusters
    const branchLength = 100; // Length of the 'arms' from LCA to species

    const nodePositions = new Map(); // Map node ID to {x, y}
    let currentYOffset = nodePadding; // Tracks the current vertical position for placing clusters

    // 2. Identify unique LCA nodes that are currently revealed (these will be the center of each "star" cluster)
    const uniqueLCAIds = new Set();
    revealedEdges.forEach(edgeId => {
        if (edgeId.startsWith('direct-')) {
            const parts = edgeId.split('-');
            uniqueLCAIds.add(parts[1]); // The LCA ID is the second part in "direct-LCA_ID-SPECIES_ID"
        }
    });

    console.log("DEBUG: Unique LCA IDs derived from revealedEdges:", Array.from(uniqueLCAIds));

    // 3. Layout each unique LCA cluster
    Array.from(uniqueLCAIds).sort().forEach(lcaId => { // Sort for consistent order
        const lcaNode = findNodeById(lcaId, flatTreeData); // Retrieve the actual LCA node object
        if (!lcaNode) {
            console.warn(`DEBUG: LCA node ${lcaId} not found in flatTreeData (even though it's in revealedEdges). Skipping cluster layout.`);
            return; // Skip this cluster if the LCA node object itself is missing
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
                        console.warn(`DEBUG: Child node ${parts[2]} for LCA ${lcaId} not found in flatTreeData or not in revealedNodes. Skipping child.`);
                    }
                }
            }
        });

        // Ensure children are unique and retrieve their full node objects again
        const uniqueChildrenNodes = Array.from(new Set(clusterChildren.map(n => n.id)))
                                    .map(id => findNodeById(id, flatTreeData))
                                    .filter(Boolean); // Filter any nulls if a child node somehow wasn't found

        // Calculate positions for this specific cluster
        const lcaX = svgWidth / 2; // Center LCA horizontally
        const lcaY = currentYOffset + branchLength; // Position LCA a bit down from current offset

        nodePositions.set(lcaNode.id, { x: lcaX, y: lcaY });

        // Position children in a line below the LCA, distributed horizontally
        const numChildren = uniqueChildrenNodes.length;
        if (numChildren > 0) {
            const childrenClusterWidth = numChildren * (nodeRadius * 2 + nodePadding);
            // Center the block of children nodes within the SVG width
            let currentChildX = (svgWidth - childrenClusterWidth) / 2 + nodeRadius;

            uniqueChildrenNodes.sort((a,b) => a.name.localeCompare(b.name)).forEach((childNode, index) => {
                const childX = currentChildX;
                const childY = lcaY + branchLength; // Position children below LCA
                nodePositions.set(childNode.id, { x: childX, y: childY });
                currentChildX += (nodeRadius * 2 + nodePadding);
            });
        }
        // Advance Y offset for the next cluster to be drawn below this one
        currentYOffset += (branchLength + nodeRadius * 2 + clusterVerticalSpacing);
    });

    const totalHeight = currentYOffset; // Final height for the SVG canvas

    gameTreeSvg.style.height = `${totalHeight}px`; // Set height for the SVG element's style
    gameTreeSvg.setAttribute('width', svgWidth); // Set SVG attribute for viewBox/scaling


    // 1. Draw "Direct Jump" Paths (from LCA to species, skipping intermediates)
    revealedEdges.forEach(edgeId => {
        if (edgeId.startsWith('direct-')) { // Only process our special direct links
            const parts = edgeId.split('-'); // e.g., ["direct", "LCA_ID", "SPECIES_ID"]
            const lcaNodeId = parts[1];
            const speciesNodeId = parts[2];

            const lcaPos = nodePositions.get(lcaNodeId);
            const speciesPos = nodePositions.get(speciesNodeId);

            if (lcaPos && speciesPos) { // Ensure both positions were found
                const linkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                linkPath.setAttribute('d', `M${lcaPos.x},${lcaPos.y} L${speciesPos.x},${speciesPos.y}`); // Direct straight line
                linkPath.classList.add('link-path');
                linkPath.classList.add('direct-link-path'); // Specific class for styling these direct links
                gameTreeSvg.appendChild(linkPath);
            } else {
                console.warn(`DEBUG: Missing positions for edge ${edgeId}. LCA Pos found: ${!!lcaPos}, Species Pos found: ${!!speciesPos}`);
            }
        }
    });


    // 2. Draw Nodes (Circles or Rectangles) and Text
    revealedNodes.forEach(nodeId => { // Iterate over all IDs in revealedNodes to draw them
        const node = findNodeById(nodeId, flatTreeData); // Retrieve the actual node object
        const pos = nodePositions.get(nodeId); // Get its calculated position

        if (node && pos) { // Only draw if node data and position exist
            const isMystery = (mysterySpecies && node.id === mysterySpecies.id);
            const isGuessed = guessedSpeciesHistory.includes(node.id);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); // Create a group for shape and text
            g.classList.add('node-group');
            g.setAttribute('data-node-id', node.id);

            // Add click listener for popup
            g.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevents click from bubbling to document immediately
                if (onNodeClick) {
                    onNodeClick(node); // Call the provided callback with the node data
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
            } else { // Species (rectangles)
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                const tempTextContent = (isMystery && !isGuessed) ? '???' : node.name;
                const textWidthEstimate = tempTextContent.length * 6 + 10; // Simple estimate
                const rectWidth = Math.max(nodeRadius * 2.5, textWidthEstimate); // Ensure wide enough
                const rectHeight = nodeRadius * 2;
                shape.setAttribute('x', pos.x - rectWidth / 2);
                shape.setAttribute('y', pos.y - rectHeight / 2);
                shape.setAttribute('width', rectWidth);
                shape.setAttribute('height', rectHeight);
                shape.setAttribute('rx', 5); // Rounded corners
                shape.setAttribute('ry', 5);
                shape.classList.add('node-rect');

                if (isMystery && !isGuessed) {
                    nodeNameDisplay = '???'; // Display ??? for unguessed mystery species
                }
            }

            // Apply specific classes for styling
            if (isMystery) {
                g.classList.add('mystery-node');
            }
            if (isGuessed) {
                g.classList.add('guessed-node');
            }
            // If it's a revealed node that's not the mystery or guessed, apply default revealed style
            if (!g.classList.contains('mystery-node') && !g.classList.contains('guessed-node')) {
                 g.classList.add('revealed-node');
            }

            g.appendChild(shape);

            // Add text label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y + 4); // Adjust for vertical centering
            text.classList.add('node-text');
            text.textContent = nodeNameDisplay;
            g.appendChild(text);

            gameTreeSvg.appendChild(g);
        } else {
            console.warn(`DEBUG: Skipping drawing node ${nodeId}. Node object: ${!!node}, Position: ${!!pos}`);
        }
    });
}
