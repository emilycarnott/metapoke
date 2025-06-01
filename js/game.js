// js/game.js (This is the main entry point)

import { convertNestedToFlat, findNodeById, findNodeByName, findLowestCommonAncestor, getPathToRoot } from './modules/data-utils.js';
import { renderGameTree } from './modules/tree-renderer.js';
import { showTooltip, hideTooltip } from './modules/tooltip.js';

// --- Global Game State Variables ---
let flatTreeData = [];
let mysterySpecies = null;
let allSpeciesNames = [];
let guessedSpeciesHistory = [];
let revealedNodes = new Set(); // IDs of nodes to display (CUMULATIVE)
let revealedEdges = new Set(); // IDs of edges to display (CUMULATIVE)

// REMOVED: No longer need to track revealedLCAId as it's cumulative now.
// let revealedLCAId = null;

const TREE_DATA_PATH = 'data/tree_of_life.json';

// --- DOM Elements ---
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const gameMessage = document.getElementById('game-message');
const speciesGuessInput = document.getElementById('species-guess');
const speciesNamesDatalist = document.getElementById('species-names');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const restartGameBtn = document.getElementById('restart-game-btn');
const gameTreeSvg = document.getElementById('game-tree-svg');
const guessForm = document.getElementById('guess-form');

// --- UPDATED: Helper for Revelation (now cumulative) ---
function revealPath(guessNodeId) {
    if (!mysterySpecies || !guessNodeId) {
        console.warn("Reveal path called without mystery species or guessNodeId.");
        return;
    }

    const currentLCAId = findLowestCommonAncestor(guessNodeId, mysterySpecies.id, flatTreeData);
    if (!currentLCAId) {
        console.warn("Could not find LCA for revelation for guess:", guessNodeId);
        return;
    }

    // REMOVED: No longer clear revealedNodes/Edges on each guess, it's cumulative.
    // if (revealedLCAId === null || revealedLCAId !== currentLCAId) {
    //     revealedNodes.clear();
    //     revealedEdges.clear();
    //     revealedLCAId = currentLCAId;
    // }

    // 1. Reveal the path from the GUESSED species up to the LCA (inclusive)
    let currentNodeId = guessNodeId;
    while (currentNodeId && currentNodeId !== currentLCAId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId, flatTreeData)?.parentId;
        if (parentId) {
            revealedEdges.add(`${parentId}-${currentNodeId}`);
        }
        currentNodeId = parentId;
    }
    revealedNodes.add(currentLCAId); // Ensure LCA itself is added

    // 2. Reveal the path from the MYSTERY species up to the LCA (inclusive)
    currentNodeId = mysterySpecies.id;
    while (currentNodeId && currentNodeId !== currentLCAId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId, flatTreeData)?.parentId;
        if (parentId) {
            revealedEdges.add(`${parentId}-${currentNodeId}`);
        }
        currentNodeId = parentId;
    }
    // LCA is already added by the previous step

    // 3. Reveal the path from the LCA up to the ULTIMATE ROOT of the entire tree
    // This provides the lineage context as per your example (Animal -> Mammal -> Rodent)
    currentNodeId = currentLCAId;
    while (currentNodeId) {
        revealedNodes.add(currentNodeId);
        const parentId = findNodeById(currentNodeId, flatTreeData)?.parentId;
        if (parentId) {
            revealedEdges.add(`${parentId}-${currentNodeId}`);
        }
        currentNodeId = parentId;
    }

    // Ensure guessed and mystery species themselves are explicitly in revealedNodes (for styling/popups)
    revealedNodes.add(guessNodeId);
    revealedNodes.add(mysterySpecies.id);
}

// --- Game Core Functions ---

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

        allSpeciesNames = [];
        flatTreeData = convertNestedToFlat(nestedData);

        flatTreeData.forEach(node => {
            if (node.type === 'species') {
                allSpeciesNames.push(node.name.toLowerCase());
            }
        });

        speciesNamesDatalist.innerHTML = '';
        allSpeciesNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            speciesNamesDatalist.appendChild(option);
        });

        loadingMessage.style.display = 'none';
        errorMessage.style.display = 'none';
        console.log('Tree data loaded successfully!');
        startGame();

    } catch (error) {
        console.error('Failed to load tree data:', error);
        loadingMessage.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.textContent = `Error loading tree data: ${error.message}. Make sure '${TREE_DATA_PATH}' exists and is valid.`;
        submitGuessBtn.disabled = true;
    }
}

function startGame() {
    guessedSpeciesHistory = [];
    revealedNodes.clear(); // Ensure clear on NEW game start
    revealedEdges.clear(); // Ensure clear on NEW game start
    // revealedLCAId = null; // Removed as it's no longer used
    hideTooltip();

    const speciesNodes = flatTreeData.filter(node => node.type === 'species');
    if (speciesNodes.length === 0) {
        gameMessage.textContent = "Error: No species found in the tree data. Check your JSON!";
        submitGuessBtn.disabled = true;
        return;
    }

    const randomIndex = Math.floor(Math.random() * speciesNodes.length);
    mysterySpecies = speciesNodes[randomIndex];

    gameMessage.textContent = "Guess the Mystery Pokémon!";
    speciesGuessInput.value = '';
    speciesGuessInput.disabled = false;
    submitGuessBtn.disabled = false;
    restartGameBtn.style.display = 'none';
    guessForm.style.display = 'flex';

    renderCurrentTree();
    console.log("Game started. Mystery species (for debugging):", mysterySpecies.name);
}

function processGuess(event) {
    event.preventDefault();

    const guessName = speciesGuessInput.value.trim().toLowerCase();
    speciesGuessInput.value = '';

    if (!guessName) {
        gameMessage.textContent = "Please enter a Pokémon name!";
        return;
    }

    const guessedNode = findNodeByName(guessName, flatTreeData);

    if (!guessedNode || guessedNode.type !== 'species') {
        gameMessage.textContent = `"${guessName}" is not a valid Pokémon in the tree. Try again!`;
        return;
    }

    if (guessedSpeciesHistory.includes(guessedNode.id)) {
        gameMessage.textContent = `You've already guessed "${guessedNode.name}". Try a new one!`;
        return;
    }

    guessedSpeciesHistory.push(guessedNode.id);

    if (guessedNode.id === mysterySpecies.id) {
        gameMessage.textContent = `Congratulations! You guessed "${mysterySpecies.name}" in ${guessedSpeciesHistory.length} guesses!`;
        submitGuessBtn.disabled = true;
        speciesGuessInput.disabled = true;
        restartGameBtn.style.display = 'block';
        guessForm.style.display = 'none';

        revealPath(mysterySpecies.id);
    } else {
        gameMessage.textContent = `"${guessedNode.name}" is not the one. Keep guessing!`;
        revealPath(guessedNode.id);
    }

    renderCurrentTree();
}

function renderCurrentTree() {
    renderGameTree({
        gameTreeSvg,
        flatTreeData,
        revealedNodes,
        revealedEdges,
        mysterySpecies,
        guessedSpeciesHistory,
        onNodeClick: (node) => {
            if (revealedNodes.has(node.id) || (mysterySpecies && node.id === mysterySpecies.id && guessedSpeciesHistory.includes(node.id))) {
                showTooltip(node);
            } else {
                hideTooltip(); // Hide if clicking an unrevealed part of the tree
            }
        }
    });
}

// --- Event Listeners ---
guessForm.addEventListener('submit', processGuess);
restartGameBtn.addEventListener('click', startGame);

document.addEventListener('click', (event) => {
    const tooltipElement = document.getElementById('node-info-popup');

    if (tooltipElement && !tooltipElement.contains(event.target) && !gameTreeSvg.contains(event.target)) {
        hideTooltip();
    }
});


// --- Initial Game Load ---
document.addEventListener('DOMContentLoaded', loadTreeData);
