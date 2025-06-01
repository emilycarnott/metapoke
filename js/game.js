// js/game.js

let flatTreeData = []; // Stores the flat list of all nodes
let mysterySpecies = null; // The randomly chosen target species
let allSpeciesNames = []; // List of all species names for autocomplete
let guessedSpeciesHistory = []; // Stores valid guesses made by the player
let revealedNodes = new Set(); // Stores IDs of nodes that should be visible
let revealedEdges = new Set(); // Stores IDs of edges (parentID-childID string) that should be visible

const TREE_DATA_PATH = 'data/tree_of_life.json'; // Path to your exported JSON file

// DOM Elements
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const gameMessage = document.getElementById('game-message');
const speciesGuessInput = document.getElementById('species-guess');
const speciesNamesDatalist = document.getElementById('species-names');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const restartGameBtn = document.getElementById('restart-game-btn');
const gameTreeSvg = document.getElementById('game-tree-svg');
const guessForm = document.getElementById('guess-form');

// --- Helper Functions for Tree Traversal ---

// Converts nested JSON to flat structure, adds parentId, and collects species names
function convertNestedToFlat(nestedNodes, parentId = null) {
    let flatList = [];
    nestedNodes.forEach(node => {
        const newNode = {
            id: node.id,
            name: node.name,
            description: node.description || '',
            imageUrl: node.imageUrl || '',
            type: node.type,
            parentId: parentId
        };
        flatList.push(newNode);

        if (node.type === 'species') {
            allSpeciesNames.push(node.name.toLowerCase()); // Collect species names for autocomplete
        }

        if (node.children && node.children.length > 0) {
            flatList = flatList.concat(convertNestedToFlat(node.children, node.id));
        }
    });
    return flatList;
}

// Finds a node by its ID
function findNodeById(id) {
    return flatTreeData.find(node => node.id === id);
}

// Finds a node by its name (case-insensitive)
function findNodeByName(name) {
    return flatTreeData.find(node => node.name.toLowerCase() === name.toLowerCase());
}

// Gets the path from a given node up to the root (array of node IDs)
function getPathToRoot(nodeId) {
    const path = [];
    let currentNode = findNodeById(nodeId);
    while (currentNode) {
        path.unshift(currentNode.id); // Add to the beginning to get root-to-node path
        currentNode = findNodeById(currentNode.parentId);
    }
    return path;
}

// Finds the Lowest Common Ancestor (LCA) between two nodes
function findLowestCommonAncestor(node1Id, node2Id) {
    if (!node1Id || !node2Id) return null;

    const path1 = getPathToRoot(node1Id);
    const path2 = getPathToRoot(node2Id);

    let lcaId = null;
    for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if (path1[i] === path2[i]) {
            lcaId = path1[i];
        } else {
            break; // Paths diverge
        }
    }
    return lcaId;
}

// Function to mark nodes and edges as revealed based on the guess and mystery species
// This function now correctly reveals the path from the root to the LCA, and then branches to the guess and mystery.
function revealPath(guessNodeId) {
    if (!mysterySpecies || !guessNodeId) {
        console.warn("Reveal path called without mystery species or guessNodeId.");
        return;
    }

    // 1. Find the Lowest Common Ancestor (LCA)
    const lcaId = findLowestCommonAncestor(guessNodeId, mysterySpecies.id);
    if (!lcaId) {
        console.warn("Could not find LCA for revelation for guess:", guessNodeId);
        return;
    }

    // 2. Mark the path from the GUESSED species up to the LCA
    let currentNodeId = guessNodeId;
    while (currentNodeId && currentNodeId !== lcaId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId)?.parentId;
        if (parentId) {
            revealedEdges.add(`<span class="math-inline">\{parentId\}\-</span>{currentNodeId}`);
        }
        currentNodeId = parentId;
    }
    // Ensure the LCA itself is added if it's the target of the above loop
    revealedNodes.add(lcaId);

    // 3. Mark the path from the MYSTERY species up to the LCA
    currentNodeId = mysterySpecies.id;
    while (currentNodeId && currentNodeId !== lcaId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId)?.parentId;
        if (parentId) {
            revealedEdges.add(`<span class="math-inline">\{parentId\}\-</span>{currentNodeId}`);
        }
        currentNodeId = parentId;
    }
    // LCA is already added from the previous step

    // 4. Mark the path from the LCA up to the ROOT (common lineage)
    currentNodeId = lcaId;
    while (currentNodeId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId)?.parentId;
        if (parentId) {
            revealedEdges.add(`<span class="math-inline">\{parentId\}\-</span>{currentNodeId}`);
        }
        currentNodeId = parentId;
    }

    // Ensure the guessed species and mystery species nodes themselves are definitely in the revealedNodes set
    revealedNodes.add(guessNodeId);
    revealedNodes.add(mysterySpecies.id);
}


// --- Game Core Functions ---

// Loads the tree data from the JSON file
async function loadTreeData() {
    try {
        loadingMessage.textContent = 'Loading tree data...';
        const response = await fetch(TREE_DATA_PATH);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const nestedData = await response.json();
        if (!Array.isArray(nestedData) || nestedData.length === 0) {
            throw new Error('Loaded JSON is empty or not an array.');
        }

        flatTreeData = convertNestedToFlat(nestedData);

        // Populate datalist for autocomplete
        allSpeciesNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            speciesNamesDatalist.appendChild(option);
        });

        loadingMessage.style.display = 'none'; // Hide loading message
        errorMessage.style.display = 'none'; // Hide any previous errors
        console.log('Tree data loaded successfully!', flatTreeData);
        startGame();

    } catch (error) {
        console.error('Failed to load tree data:', error);
        loadingMessage.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.textContent = `Error loading tree data: ${error.message}. Make sure '${TREE_DATA_PATH}' exists and is valid.`;
        submitGuessBtn.disabled = true; // Disable game if data fails
    }
}

// Starts a new game round
function startGame() {
    guessedSpeciesHistory = [];
    revealedNodes.clear();
    revealedEdges.clear();

    const speciesNodes = flatTreeData.filter(node => node.type === 'species');
    if (speciesNodes.length === 0) {
        gameMessage.textContent = "Error: No species found in the tree data. Check your JSON!";
        submitGuessBtn.disabled = true;
        return;
    }

    // Randomly select a mystery species
    const randomIndex = Math.floor(Math.random() * speciesNodes.length);
    mysterySpecies = speciesNodes[randomIndex];

    gameMessage.textContent = "Guess the Mystery Pokémon!";
    speciesGuessInput.value = '';
    speciesGuessInput.disabled = false;
    submitGuessBtn.disabled = false;
    restartGameBtn.style.display = 'none';
    guessForm.style.display = 'flex';

    // Initial reveal: show the very first node (root) if needed, or simply start blank.
    // For now, we'll keep it blank and reveal as guesses come in.
    // However, it's good practice to mark the mystery species as a revealed node,
    // though its name won't be displayed until guessed.
    // IMPORTANT: No initial reveal of mysterySpecies.id here.
    // The tree starts completely blank. Revelation happens only after first guess.
    // This line was previously present, ensure it's removed:
    // revealedNodes.add(mysterySpecies.id); // Add mystery species to revealed nodes (will be displayed as ???)

    renderGameTree(); // Initial render of the empty/minimal tree
    console.log("Game started. Mystery species:", mysterySpecies.name); // For debugging: REMOVE IN FINAL VERSION
}

// Processes a player's guess
function processGuess(event) {
    event.preventDefault(); // Prevent page reload on form submit

    const guessName = speciesGuessInput.value.trim().toLowerCase();
    speciesGuessInput.value = ''; // Clear input field

    if (!guessName) {
        gameMessage.textContent = "Please enter a Pokémon name!";
        return;
    }

    const guessedNode = findNodeByName(guessName);

    if (!guessedNode || guessedNode.type !== 'species') {
        gameMessage.textContent = `"${guessName}" is not a valid Pokémon in the tree. Try again!`;
        return;
    }

    if (guessedSpeciesHistory.includes(guessedNode.id)) {
        gameMessage.textContent = `You've already guessed "${guessedNode.name}". Try a new one!`;
        return;
    }

    guessedSpeciesHistory.push(guessedNode.id); // Store the ID of the valid guess

    // Mark the guessed node as revealed
    revealedNodes.add(guessedNode.id);

    // If the guess is correct
    if (guessedNode.id === mysterySpecies.id) {
        gameMessage.textContent = `Congratulations! You guessed "${mysterySpecies.name}"!`;
        submitGuessBtn.disabled = true;
        speciesGuessInput.disabled = true;
        restartGameBtn.style.display = 'block';
        guessForm.style.display = 'none';

        // Ensure mystery species is fully revealed (no ???)
        revealedNodes.add(mysterySpecies.id);
        // And ensure path to it is revealed if not already
        revealPath(mysterySpecies.id); // Final revelation if it wasn't already
    } else {
        gameMessage.textContent = `"${guessedNode.name}" is not the one. Keep guessing!`;
        // Reveal the path from the guessed species to its common ancestor with the mystery species
        revealPath(guessedNode.id);
    }

    renderGameTree(); // Re-render the tree with the new revealed path
}

// --- Tree Rendering (SVG) ---
// This is a placeholder. The actual SVG rendering logic will go here.
// It will dynamically create/update SVG elements based on 'revealedNodes' and 'revealedEdges'.
function renderGameTree() {
    gameTreeSvg.innerHTML = ''; // Clear previous SVG content
    // Determine nodes to consider for layout. Only revealed ones, plus their parents up to root.
    const nodesForLayout = new Set();
    revealedNodes.forEach(id => {
        let currentNode = findNodeById(id);
        while(currentNode) {
            nodesForLayout.add(currentNode.id);
            currentNode = findNodeById(currentNode.parentId);
        }
    });

// If no nodes are revealed yet (e.g., at game start), the tree should be totally blank.
if (nodesForLayout.size === 0) {
    gameTreeSvg.innerHTML = ''; // Ensure it's explicitly cleared
    gameTreeSvg.style.height = `0px`; // Collapse SVG height
    return; // Render nothing if no nodes are revealed
}
    if (flatTreeData.length === 0) {
        // This case should be handled by loadTreeData error, but as a fallback
        gameTreeSvg.textContent = "Tree data not available.";
        return;
    }

    // --- Basic Node Positioning (for MVP) ---
    // This is a simplified layout. For complex trees, you might use a library
    // like D3.js or a custom layout algorithm.
    // For now, we'll try a simple layer-by-layer horizontal or vertical layout.
    // Let's aim for a left-to-right layout.

    const svgWidth = gameTreeSvg.clientWidth;
    const svgHeight = gameTreeSvg.clientHeight;
    const nodeRadius = 15;
    const nodePadding = 30; // Space between nodes horizontally/vertically
    const levelSpacing = 100; // Vertical spacing between levels (depth)

    // Calculate depth for each node
    const nodeDepths = new Map();
    function calculateDepth(nodeId, currentDepth) {
        if (nodeDepths.has(nodeId)) return nodeDepths.get(nodeId); // Already calculated
        nodeDepths.set(nodeId, currentDepth);
        const children = flatTreeData.filter(n => n.parentId === nodeId);
        children.forEach(child => calculateDepth(child.id, currentDepth + 1));
    }
    // Start from root nodes
    flatTreeData.filter(node => node.parentId === null).forEach(root => calculateDepth(root.id, 0));


    // Group nodes by depth for layout
    const nodesByDepth = new Map();
    flatTreeData.forEach(node => {
        const depth = nodeDepths.get(node.id) || 0; // Default to 0 if no depth (e.g., orphan)
        if (!nodesByDepth.has(depth)) {
            nodesByDepth.set(depth, []);
        }
        nodesByDepth.get(depth).push(node);
    });

    // Assign X and Y coordinates
    const nodePositions = new Map(); // Map node ID to {x, y}
    let maxDepth = 0;
    if (nodesByDepth.size > 0) {
        maxDepth = Math.max(...Array.from(nodesByDepth.keys()));
    }

    let currentY = nodePadding; // Y position for the first node at this depth
    for (let depth = 0; depth <= maxDepth; depth++) {
        const nodesInLevel = nodesByDepth.get(depth) || [];
        const levelWidth = nodesInLevel.length * (nodeRadius * 2 + nodePadding);
        let currentX = (svgWidth - levelWidth) / 2 + nodeRadius; // Center the level

        nodesInLevel.forEach(node => {
            const x = currentX;
            const y = nodePadding + (depth * levelSpacing); // Y based on depth
            nodePositions.set(node.id, { x, y });
            currentX += (nodeRadius * 2 + nodePadding);
        });
    }

    // Adjust SVG height if tree is taller than initial height
    const calculatedHeight = nodePadding + (maxDepth * levelSpacing) + nodePadding;
    if (calculatedHeight > svgHeight) {
        gameTreeSvg.style.height = `${calculatedHeight}px`;
    }


    // 1. Draw Paths (Links)
    flatTreeData.forEach(node => {
        if (node.parentId) {
            const parentPos = nodePositions.get(node.parentId);
            const childPos = nodePositions.get(node.id);

            if (parentPos && childPos) {
                const linkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                linkPath.setAttribute('d', `M${parentPos.x},${parentPos.y} L${childPos.x},${childPos.y}`); // Simple straight line
                linkPath.classList.add('link-path');

                // Check if this edge should be revealed
                if (revealedEdges.has(`${node.parentId}-${node.id}`)) {
                    linkPath.classList.add('revealed-link-path');
                }
                gameTreeSvg.appendChild(linkPath);
            }
        }
    });

    // 2. Draw Nodes (Circles or Rectangles) and Text
    flatTreeData.forEach(node => {
        const pos = nodePositions.get(node.id);
        if (pos) {
            const isMystery = (mysterySpecies && node.id === mysterySpecies.id);
            const isGuessed = guessedSpeciesHistory.includes(node.id); // Check if this specific node was a guess
            const isRevealedNode = revealedNodes.has(node.id); // Check if this node is in our revealed set

            // Only draw nodes that are explicitly revealed or are the mystery species.
            // If it's not in revealedNodes and it's not the mystery species, skip drawing it.
            if (!isRevealedNode && !isMystery) {
                return; // Skip drawing unrevealed nodes
            }

            // Create a group for each node (circle/rect + text)
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.classList.add('node-group'); // For general node styling

            let shape;
            if (node.type === 'family') {
                shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                shape.setAttribute('r', nodeRadius);
                shape.setAttribute('cx', pos.x);
                shape.setAttribute('cy', pos.y);
                shape.classList.add('node-circle');
            } else { // Species
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                const textWidth = node.name.length * 6 + 10; // Rough estimate for text width
                const rectWidth = Math.max(nodeRadius * 2, textWidth); // Ensure rect is wide enough
                const rectHeight = nodeRadius * 2;
                shape.setAttribute('x', pos.x - rectWidth / 2);
                shape.setAttribute('y', pos.y - rectHeight / 2);
                shape.setAttribute('width', rectWidth);
                shape.setAttribute('height', rectHeight);
                shape.setAttribute('rx', 5); // Rounded corners
                shape.setAttribute('ry', 5);
                shape.classList.add('node-rect');
            }

            // Apply specific classes for styling
            if (isMystery) {
                g.classList.add('mystery-node');
            } else if (isGuessed) {
                g.classList.add('guessed-node');
            } else if (isRevealed) {
                g.classList.add('revealed-node');
            }

            g.appendChild(shape);

            // Add text label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y + 4); // Adjust for vertical centering
            text.classList.add('node-text');

            // Display ??? if mystery and not yet guessed
            if (isMystery && !isGuessed) {
                text.textContent = '???';
            } else {
                text.textContent = node.name;
            }
            g.appendChild(text);

            gameTreeSvg.appendChild(g);
        }
    });

    // Finally, ensure the SVG dimensions are correctly set for viewing
    gameTreeSvg.setAttribute('width', svgWidth);
    gameTreeSvg.setAttribute('height', calculatedHeight > svgHeight ? calculatedHeight : svgHeight);
}


// --- Event Listeners ---

guessForm.addEventListener('submit', processGuess);
restartGameBtn.addEventListener('click', startGame);

// --- Initial Game Load ---
document.addEventListener('DOMContentLoaded', loadTreeData);
