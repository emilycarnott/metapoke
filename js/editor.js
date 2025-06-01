// js/editor.js
alert("Editor JavaScript is loading!");

// 1. In-memory data structure for our tree nodes (flat list)
let treeData = [];

// 2. Get references to important DOM elements
const addFamilyBtn = document.getElementById('addFamilyBtn');
const addSpeciesBtn = document.getElementById('addSpeciesBtn');
const treeVisualization = document.getElementById('treeVisualization');
const nodePropertiesPanel = document.getElementById('nodePropertiesPanel');
const saveEditBtn = document.getElementById('saveEditBtn');
const deleteNodeBtn = document.getElementById('deleteNodeBtn');
const loadJsonInput = document.getElementById('loadJsonInput');
const loadJsonBtn = document.getElementById('loadJsonBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');


// Function to generate a unique ID for each node
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers (less robust but usually sufficient for local dev)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Function to render (or re-render) the tree visualization
// This will be called whenever treeData changes
function renderTree() {
    // Clear existing visualization
    treeVisualization.innerHTML = '';
    const emptyMessage = treeVisualization.querySelector('.empty-tree-message');
    if (emptyMessage) {
        emptyMessage.remove(); // Remove the placeholder if it exists
    }

    if (treeData.length === 0) {
        treeVisualization.innerHTML = '<div class="empty-tree-message">No nodes yet. Add some!</div>';
        return;
    }

    // Helper to build the nested HTML structure from the flat treeData
    function buildTreeHTML(nodes, currentParentId, depth = 0) {
        const ul = document.createElement('ul');
        // Apply a class for styling nested lists
        ul.classList.add('tree-list');
        // ul.style.paddingLeft = `${depth * 20}px`; // Indent based on depth - now handled by CSS

        nodes.filter(node => node.parentId === currentParentId)
             .forEach(node => {
                const li = document.createElement('li');
                li.className = 'tree-node';
                li.dataset.nodeId = node.id; // Store the node ID on the element
                li.draggable = true; // Make nodes draggable

                // Display node name and type
                const nodeContent = document.createElement('div');
                nodeContent.className = 'node-content';
                nodeContent.innerHTML = `
                    <span class="node-type-icon">${node.type === 'family' ? '📁' : '🌱'}</span>
                    <span class="node-name">${node.name}</span>
                    <span class="node-id-display" style="font-size: 0.7em; color: #888;">(${node.id.substring(0, 8)})</span>
                `;
                li.appendChild(nodeContent);

                // Add event listener to select/edit node
                nodeContent.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent drag/drop interference
                    selectNode(node.id);
                });

                // Add drop target capability to family nodes
                if (node.type === 'family') {
                    li.classList.add('family-node'); // For styling drop areas
                    li.addEventListener('dragover', handleDragOver);
                    li.addEventListener('dragleave', handleDragLeave);
                    li.addEventListener('drop', handleDrop);
                }

                // Add drag events
                li.addEventListener('dragstart', handleDragStart);
                li.addEventListener('dragend', handleDragEnd);


                ul.appendChild(li);

                // Recursively add children
                const children = treeData.filter(child => child.parentId === node.id);
                if (children.length > 0) {
                    ul.appendChild(buildTreeHTML(nodes, node.id, depth + 1));
                }
            });
        return ul;
    }

    // Start rendering from root nodes (parentId: null)
    // Only append root nodes to the main visualization container
    const rootNodes = treeData.filter(node => node.parentId === null);
    if (rootNodes.length > 0) {
        const rootList = buildTreeHTML(treeData, null, 0);
        treeVisualization.appendChild(rootList);
    } else {
        treeVisualization.innerHTML = '<div class="empty-tree-message">No root nodes. Drag existing nodes to the top level, or add new ones!</div>';
    }


    // After rendering, save to local storage
    saveTreeToLocalStorage();
}


// --- Drag and Drop Functions ---
let draggedNodeId = null;

function handleDragStart(event) {
    draggedNodeId = event.target.dataset.nodeId;
    event.dataTransfer.setData('text/plain', draggedNodeId);
    event.target.classList.add('dragging');
    event.stopPropagation(); // Prevent parent drag from also starting
}

function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    const targetNodeElement = event.currentTarget;
    if (targetNodeElement.classList.contains('family-node')) {
        targetNodeElement.classList.add('drag-over');
    }
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    const targetNodeElement = event.currentTarget;
    targetNodeElement.classList.remove('drag-over');

    const droppedNodeId = event.dataTransfer.getData('text/plain');
    const targetParentId = targetNodeElement.dataset.nodeId; // The ID of the family we're dropping onto

    const droppedNode = treeData.find(node => node.id === droppedNodeId);
    const targetNode = treeData.find(node => node.id === targetParentId);

    if (droppedNode && targetNode && targetNode.type === 'family') {
        // Prevent dropping a node onto itself
        if (droppedNode.id === targetNode.id) {
            return;
        }

        // Prevent dropping a parent onto its own child (circular dependency)
        let tempParent = targetNode;
        while(tempParent) {
            if (tempParent.id === droppedNode.id) {
                console.warn("Cannot drop a node onto its own descendant.");
                return;
            }
            tempParent = treeData.find(n => n.id === tempParent.parentId);
        }

        droppedNode.parentId = targetParentId;
        renderTree();
    } else {
        console.warn("Invalid drop target. Can only drop onto a Family node.");
    }

    draggedNodeId = null; // Reset
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedNodeId = null; // Reset
}

// --- Node Creation Functions ---

function createNode(type) {
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;

    const description = prompt(`Enter description for ${name}:`);
    const imageUrl = prompt(`Enter image URL for ${name} (optional):`);

    const newNode = {
        id: generateUUID(),
        name: name.trim(),
        description: description ? description.trim() : '',
        imageUrl: imageUrl ? imageUrl.trim() : '',
        type: type,
        parentId: null // New nodes are added as root initially
    };

    treeData.push(newNode);
    renderTree(); // Re-render to show the new node and save
}

// --- Node Editing and Deletion ---
let selectedNodeId = null;

function selectNode(nodeId) {
    // Deselect previous node if any
    if (selectedNodeId) {
        const prevSelectedElement = treeVisualization.querySelector(`[data-node-id="${selectedNodeId}"]`);
        if (prevSelectedElement) {
            prevSelectedElement.classList.remove('selected');
        }
    }

    selectedNodeId = nodeId;
    const selectedNode = treeData.find(node => node.id === nodeId);

    if (selectedNode) {
        // Highlight the selected node in the visualization
        const selectedElement = treeVisualization.querySelector(`[data-node-id="${nodeId}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }

        // Show and populate the properties panel
        nodePropertiesPanel.style.display = 'block';
        document.getElementById('editName').value = selectedNode.name;
        document.getElementById('editDescription').value = selectedNode.description;
        document.getElementById('editImageUrl').value = selectedNode.imageUrl;
        document.getElementById('editIsSpecies').checked = (selectedNode.type === 'species');
    }
}

function saveNodeChanges() {
    if (!selectedNodeId) return;

    const nodeToEdit = treeData.find(node => node.id === selectedNodeId);
    if (nodeToEdit) {
        const oldType = nodeToEdit.type; // Store old type to check for changes
        nodeToEdit.name = document.getElementById('editName').value.trim();
        nodeToEdit.description = document.getElementById('editDescription').value.trim();
        nodeToEdit.imageUrl = document.getElementById('editImageUrl').value.trim();
        nodeToEdit.type = document.getElementById('editIsSpecies').checked ? 'species' : 'family';

        // If a family node becomes a species, it can no longer have children
        // We need to detach its current children by setting their parentId to null or re-parenting
        if (oldType === 'family' && nodeToEdit.type === 'species') {
            const children = treeData.filter(node => node.parentId === nodeToEdit.id);
            children.forEach(child => child.parentId = null); // Make children root nodes
            alert(`"${nodeToEdit.name}" was a family and is now a species. Its former children have been moved to the root level.`);
        }

        renderTree(); // Re-render to show updated name/type and save
        nodePropertiesPanel.style.display = 'none'; // Hide after saving
        selectedNodeId = null; // Deselect
    }
}

function deleteSelectedNode() {
    if (!selectedNodeId) return;

    const nodeToDelete = treeData.find(node => node.id === selectedNodeId);
    if (!nodeToDelete) return;

    if (!confirm(`Are you sure you want to delete "${nodeToDelete.name}"? This will also delete all its descendants!`)) {
        return; // User cancelled
    }

    // Recursively collect IDs of all nodes to delete (node itself and its descendants)
    const nodesToDeleteIds = new Set();
    function collectDescendantIds(nodeId) {
        nodesToDeleteIds.add(nodeId);
        treeData.filter(n => n.parentId === nodeId).forEach(child => {
            collectDescendantIds(child.id);
        });
    }
    collectDescendantIds(selectedNodeId);

    // Filter out all nodes whose IDs are in our set of nodes to delete
    treeData = treeData.filter(node => !nodesToDeleteIds.has(node.id));

    renderTree(); // Re-render the tree and save
    nodePropertiesPanel.style.display = 'none'; // Hide panel
    selectedNodeId = null; // Deselect
}

// --- Local Storage Save/Load ---

const LOCAL_STORAGE_KEY = 'metapokeTreeData';

function saveTreeToLocalStorage() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(treeData));
        console.log('Tree data saved to local storage.');
    } catch (e) {
        console.error('Error saving to local storage:', e);
        alert('Could not save data to local storage. It might be full or disabled.');
    }
}

function loadTreeFromLocalStorage() {
    try {
        const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedData) {
            treeData = JSON.parse(storedData);
            console.log('Tree data loaded from local storage.');
            renderTree(); // Re-render after loading
            return true; // Indicate success
        }
    } catch (e) {
        console.error('Error loading from local storage:', e);
        alert('Could not load data from local storage. It might be corrupted.');
    }
    return false; // Indicate failure or no data
}

// --- JSON File Export/Import ---

// Converts the flat treeData structure into a nested JSON structure for export
function convertFlatToNested(flatNodes) {
    const nodeMap = new Map();
    const rootNodes = [];

    // Create a map of all nodes by their ID for easy lookup, and initialize children arrays
    flatNodes.forEach(node => {
        nodeMap.set(node.id, { ...node, children: [] });
    });

    // Assign children to their parents
    flatNodes.forEach(node => {
        const mappedNode = nodeMap.get(node.id); // Get the mutable node from the map

        if (node.parentId === null) {
            rootNodes.push(mappedNode); // It's a root node
        } else {
            const parent = nodeMap.get(node.parentId);
            if (parent && parent.type === "family") { // Only families can have children
                parent.children.push(mappedNode);
            }
            // If parent not found or not a family, consider it an orphaned node and potentially log an error
            // For now, it won't be part of the nested structure unless its parent exists and is a family.
            // This is okay for export, but in the editor, we ensure parentId points to valid families.
        }
    });

    // Ensure children arrays are sorted by some criteria if needed (e.g., name)
    // For this example, we'll keep the order they were added or found.
    rootNodes.forEach(node => sortChildrenRecursively(node));

    return rootNodes;
}

// Helper to sort children recursively for consistent export (optional)
function sortChildrenRecursively(node) {
    if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => a.name.localeCompare(b.name));
        node.children.forEach(child => sortChildrenRecursively(child));
    }
}


// Converts a loaded nested JSON structure back into our flat treeData for editing
function convertNestedToFlat(nestedNodes, parentId = null) {
    let flatList = [];
    nestedNodes.forEach(node => {
        const newNode = {
            id: node.id,
            name: node.name,
            description: node.description || '', // Ensure exists
            imageUrl: node.imageUrl || '', // Ensure exists
            type: node.type,
            parentId: parentId
        };
        flatList.push(newNode);
        if (node.children && node.children.length > 0) {
            flatList = flatList.concat(convertNestedToFlat(node.children, node.id));
        }
    });
    return flatList;
}

// Event handler for exporting JSON file
exportJsonBtn.addEventListener('click', () => {
    const nestedData = convertFlatToNested(treeData);
    const jsonString = JSON.stringify(nestedData, null, 2); // Pretty print with 2 spaces
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tree_of_life.json'; // Suggested filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Clean up the URL object
    alert('Tree exported as tree_of_life.json!');
});

// Event handler for importing JSON file
loadJsonBtn.addEventListener('click', () => {
    loadJsonInput.click(); // Programmatically click the hidden file input
});

loadJsonInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loadedNestedData = JSON.parse(e.target.result);
            // Basic validation: Check if it looks like our tree structure
            if (!Array.isArray(loadedNestedData) || loadedNestedData.some(node => !node.id || !node.name)) {
                alert('Invalid JSON file format. Please ensure it contains an array of nodes with "id" and "name" properties.');
                return;
            }

            // Convert to flat structure for internal editor use
            treeData = convertNestedToFlat(loadedNestedData);
            renderTree(); // Re-render the editor view with the loaded data
            alert('Tree loaded successfully from JSON file!');
            // Clear the file input value so that the same file can be loaded again if needed
            event.target.value = '';
        } catch (error) {
            console.error('Error parsing JSON or converting tree:', error);
            alert('Error loading JSON file. Please ensure it is a valid JSON format.');
        }
    };
    reader.readAsText(file); // Read the file as text
});


// --- Initial Load ---

// Load from local storage when the page loads
document.addEventListener('DOMContentLoaded', () => {
    if (!loadTreeFromLocalStorage()) {
        console.log("No data found in local storage or error occurred, starting with empty tree.");
        renderTree(); // Render an empty tree if no data was loaded
    }
});
