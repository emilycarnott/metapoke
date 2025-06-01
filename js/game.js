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

        if (newNode.type === 'species') { // Use newNode as it has all properties
            allSpeciesNames.push(newNode.name.toLowerCase()); // Collect species names for autocomplete
        }

        if (node.children && node.children.length > 0) {
            flatList = flatList.concat(convertNestedToFlat(node.children, newNode.id));
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

// --- NEW/UPDATED: Function to mark nodes and edges as revealed based on the guess and mystery species ---
// This function now correctly reveals the path from the root to the LCA, and then branches to the guess and mystery.
function revealPath(guessNodeId) {
    if (!mysterySpecies || !guessNodeId) {
        console.warn("Reveal path called without mystery species or guessNodeId.");
        return;
    }

    const lcaId = findLowestCommonAncestor(guessNodeId, mysterySpecies.id);
    if (!lcaId) {
        console.warn("Could not find LCA for revelation for guess:", guessNodeId);
        return;
    }

    // 1. Reveal path from the GUESSED species up to the LCA
    let currentNodeId = guessNodeId;
    while (currentNodeId && currentNodeId !== lcaId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId)?.parentId;
        if (parentId) {
            revealedEdges.add(`${parentId}-${currentNodeId}`);
        }
        currentNodeId = parentId;
    }
    revealedNodes.add(lcaId); // Ensure the LCA itself is added

    // 2. Reveal path from the MYSTERY species up to the LCA
    currentNodeId = mysterySpecies.id;
    while (currentNodeId && currentNodeId !== lcaId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId)?.parentId;
        if (parentId) {
            revealedEdges.add(`${parentId}-${currentNodeId}`);
        }
        currentNodeId = parentId;
    }
    // LCA is already added from the previous step

    // 3. Reveal path from the LCA up to the ROOT (common lineage)
    currentNodeId = lcaId;
    while (currentNodeId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId)?.parentId;
        if (parentId) {
            revealedEdges.add(`${parentId}-${currentNodeId}`);
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

        // Reset allSpeciesNames before converting new data
        allSpeciesNames = [];
        flatTreeData = convertNestedToFlat(nestedData);

        // Populate datalist for autocomplete
        // Clear previous options first if reloading data
        speciesNamesDatalist.innerHTML = '';
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

// --- UPDATED: Starts a new game round for a truly blank start ---
function startGame() {
    guessedSpeciesHistory = [];
    revealedNodes.clear(); // Ensure completely blank slate
    revealedEdges.clear(); // Ensure completely blank slate

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

    // IMPORTANT: No initial reveal of mysterySpecies.id here.
    // The tree starts completely blank. Revelation happens only after first guess.

    renderGameTree(); // Initial render of the totally blank tree
    console.log("Game started. Mystery species (for debugging, will remove in final version):", mysterySpecies.name);
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

    // If the guess is correct
    if (guessedNode.id === mysterySpecies.id) {
        gameMessage.textContent = `Congratulations! You guessed "${mysterySpecies.name}" in ${guessedSpeciesHistory.length} guesses!`;
        submitGuessBtn.disabled = true;
        speciesGuessInput.disabled = true;
        restartGameBtn.style.display = 'block';
        guessForm.style.display = 'none';

        // Ensure the path to the mystery species (which is now also the guessed species) is fully revealed
        revealPath(mysterySpecies.id); // Call with mysterySpecies.id
    } else {
        gameMessage.textContent = `"${guessedNode.name}" is not the one. Keep guessing!`;
        // Reveal the path from the guessed species to its common ancestor with the mystery species
        revealPath(guessedNode.id);
    }

    renderGameTree(); // Re-render the tree with the new revealed path
}

// --- UPDATED: Tree Rendering (SVG) ---
function renderGameTree() {
    gameTreeSvg.innerHTML = ''; // Clear previous SVG content

    if (flatTreeData.length === 0) {
        // This case should be handled by loadTreeData error, but as a fallback
        gameTreeSvg.textContent = "Tree data not available.";
        return;
    }

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

    // Filter flatTreeData to only include nodes that need to be laid out
    const currentLayoutNodes = flatTreeData.filter(node => nodesForLayout.has(node.id));

    // Calculate depth for each node *in the currentLayoutNodes set*
    const nodeDepths = new Map();
    // Find true root nodes among the nodesForLayout (those without parents in the layout set, or global parents are null)
    currentLayoutNodes.filter(node => !node.parentId || !nodesForLayout.has(node.parentId)).forEach(root => {
        // Ensure we find the highest ancestor in the displayed tree for consistent depth calculation
        let actualRootNode = root;
        while(actualRootNode.parentId && nodesForLayout.has(actualRootNode.parentId)) {
            actualRootNode = findNodeById(actualRootNode.parentId);
        }
        calculateDepthForLayout(actualRootNode.id, 0, nodeDepths, currentLayoutNodes);
    });

    // Helper to calculate depth specifically for the *current* layout set
    function calculateDepthForLayout(nodeId, currentDepth, depthMap, availableNodes) {
        if (depthMap.has(nodeId)) return; // Already calculated
        depthMap.set(nodeId, currentDepth);
        availableNodes.filter(n => n.parentId === nodeId).forEach(child => {
            calculateDepthForLayout(child.id, currentDepth + 1, depthMap, availableNodes);
        });
    }

    const svgWidth = gameTreeSvg.clientWidth;
    const nodeRadius = 15;
    const nodePadding = 30; // Vertical padding between elements at different levels
    const levelSpacing = 100; // Vertical spacing between levels (depth)

    const nodesByDepth = new Map();
    currentLayoutNodes.forEach(node => {
        const depth = nodeDepths.get(node.id);
        if (depth !== undefined) { // Only consider nodes for which depth was calculated
            if (!nodesByDepth.has(depth)) {
                nodesByDepth.set(depth, []);
            }
            nodesByDepth.get(depth).push(node);
        }
    });

    let maxDepth = 0;
    if (nodesByDepth.size > 0) {
        maxDepth = Math.max(...Array.from(nodesByDepth.keys()));
    }

    // Determine max number of nodes in any level to set horizontal scaling
    let maxNodesInLevel = 0;
    nodesByDepth.forEach(nodes => {
        if (nodes.length > maxNodesInLevel) {
            maxNodesInLevel = nodes.length;
        }
    });
    // Dynamically adjust horizontal spacing based on max nodes in a level
    const minHorizontalNodeSpace = nodeRadius * 2 + nodePadding;
    let effectiveHorizontalSpace = svgWidth / (maxNodesInLevel + 1);
    effectiveHorizontalSpace = Math.max(effectiveHorizontalSpace, minHorizontalNodeSpace);


    // Assign X and Y coordinates (dynamic centering per level)
    const nodePositions = new Map(); // Map node ID to {x, y}
    for (let depth = 0; depth <= maxDepth; depth++) {
        const nodesInLevel = nodesByDepth.get(depth) || [];
        // Sort nodes in level by ID to ensure consistent horizontal order across renders
        nodesInLevel.sort((a, b) => a.id.localeCompare(b.id));

        const levelTotalWidth = nodesInLevel.length * effectiveHorizontalSpace;
        let currentX = (svgWidth - levelTotalWidth) / 2 + effectiveHorizontalSpace / 2; // Center offset

        nodesInLevel.forEach(node => {
            const x = currentX;
            const y = nodeRadius + (depth * levelSpacing); // Y based on depth
            nodePositions.set(node.id, { x, y });
            currentX += effectiveHorizontalSpace;
        });
    }

    const calculatedHeight = nodeRadius + (maxDepth * levelSpacing) + nodeRadius + 20; // Add some margin
    gameTreeSvg.style.height = `${calculatedHeight}px`; // Set height via style for responsiveness
    gameTreeSvg.setAttribute('width', svgWidth); // Set SVG attribute for viewBox/scaling

    // 1. Draw Paths (Links)
    currentLayoutNodes.forEach(node => {
        if (node.parentId && nodesForLayout.has(node.parentId)) { // Only draw if parent is also in the current layout
            const parentPos = nodePositions.get(node.parentId);
            const childPos = nodePositions.get(node.id);

            // Only draw path if the edge is marked as revealed
            const edgeId = `${node.parentId}-${node.id}`;
            if (parentPos && childPos && revealedEdges.has(edgeId)) {
                const linkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                // Simple straight line for now for clarity, can be curved later
                linkPath.setAttribute('d', `M${parentPos.x},${parentPos.y} L${childPos.x},${childPos.y}`);
                linkPath.classList.add('link-path');
                linkPath.classList.add('revealed-link-path'); // If drawn, it's revealed
                gameTreeSvg.appendChild(linkPath);
            }
        }
    });

    // 2. Draw Nodes (Circles or Rectangles) and Text
    currentLayoutNodes.forEach(node => {
        const pos = nodePositions.get(node.id);
        if (pos) {
            const isMystery = (mysterySpecies && node.id === mysterySpecies.id);
            const isGuessed = guessedSpeciesHistory.includes(node.id); // Check if this specific node was a guess

            // Create a group for each node (shape + text)
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.classList.add('node-group');
            // Add a data attribute for easier debugging/inspection if needed
            g.setAttribute('data-node-id', node.id);


            let shape;
            let nodeNameDisplay = node.name; // Default name

            if (node.type === 'family') {
                shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                shape.setAttribute('r', nodeRadius);
                shape.setAttribute('cx', pos.x);
                shape.setAttribute('cy', pos.y);
                shape.classList.add('node-circle');
            } else { // Species
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                // Adjust text content for width estimation
                const tempTextContent = (isMystery && !isGuessed) ? '???' : node.name;
                const textWidthEstimate = tempTextContent.length * 6 + 10; // Rough estimate for text width, adjust font-size in CSS
                const rectWidth = Math.max(nodeRadius * 2.5, textWidthEstimate); // Ensure rect is wide enough
                const rectHeight = nodeRadius * 2;
                shape.setAttribute('x', pos.x - rectWidth / 2);
                shape.setAttribute('y', pos.y - rectHeight / 2);
                shape.setAttribute('width', rectWidth);
                shape.setAttribute('height', rectHeight);
                shape.setAttribute('rx', 5); // Rounded corners
                shape.setAttribute('ry', 5);
                shape.classList.add('node-rect');

                if (isMystery && !isGuessed) {
                    nodeNameDisplay = '???'; // Override for mystery not yet guessed
                }
            }

            // Apply specific classes for styling (order matters for precedence)
            if (isMystery) {
                g.classList.add('mystery-node');
            }
            if (isGuessed) { // If it's one of the actual guesses (this will override mystery-node if it IS the mystery)
                g.classList.add('guessed-node');
            }
            // If it's a family or an un-guessed species on the path, and not already colored by mystery/guessed
            if (!g.classList.contains('mystery-node') && !g.classList.contains('guessed-node')) {
                 g.classList.add('revealed-node');
            }


            g.appendChild(shape);

            // Add text label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y + 4); // Adjust for vertical centering
            text.classList.add('node-text');
            text.textContent = nodeNameDisplay; // Use adjusted name
            g.appendChild(text);

            gameTreeSvg.appendChild(g);
        }
    });
}


// --- Event Listeners ---

guessForm.addEventListener('submit', processGuess);
restartGameBtn.addEventListener('click', startGame);

// --- Initial Game Load ---
document.addEventListener('DOMContentLoaded', loadTreeData);
