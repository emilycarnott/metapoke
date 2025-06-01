// js/editor.js

// 1. In-memory data structure for our tree nodes (flat list)
// This will hold all our nodes with their properties and parent IDs.
let treeData = [];

// 2. Get references to important DOM elements
const addFamilyBtn = document.getElementById('addFamilyBtn');
const addSpeciesBtn = document.getElementById('addSpeciesBtn');
const treeVisualization = document.getElementById('treeVisualization');
const nodePropertiesPanel = document.getElementById('nodePropertiesPanel'); // We'll use this later
const saveEditBtn = document.getElementById('saveEditBtn'); // We'll use this later
const deleteNodeBtn = document.getElementById('deleteNodeBtn'); // We'll use this later
const loadJsonInput = document.getElementById('loadJsonInput'); // We'll use this later
const loadJsonBtn = document.getElementById('loadJsonBtn'); // We'll use this later
const exportJsonBtn = document.getElementById('exportJsonBtn'); // We'll use this later


// Function to generate a unique ID for each node
// Using crypto.randomUUID() is best if supported, otherwise a fallback
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
    // We'll pass the root nodes (parentId: null) to this function first
    function buildTreeHTML(nodes, currentParentId, depth = 0) {
        const ul = document.createElement('ul');
        ul.style.paddingLeft = `${depth * 20}px`; // Indent based on depth

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

                // Add event listener to select/edit node (we'll implement this later)
                nodeContent.addEventListener('click', (event) => {
                    // Prevent this click from bubbling up to potentially trigger parent drag
                    event.stopPropagation();
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
    const rootNodesFragment = buildTreeHTML(treeData, null, 0);
    treeVisualization.appendChild(rootNodesFragment);
}


// --- Drag and Drop Functions (Placeholder for now, we'll fill these in later) ---
let draggedNodeId = null;

function handleDragStart(event) {
    draggedNodeId = event.target.dataset.nodeId;
    event.dataTransfer.setData('text/plain', draggedNodeId); // Required for drag/drop
    event.target.classList.add('dragging'); // Add a class for styling
}

function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    const targetNodeElement = event.currentTarget;
    if (targetNodeElement.classList.contains('family-node')) {
        targetNodeElement.classList.add('drag-over'); // Highlight drop target
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

    // console.log(`Dropped node ${droppedNodeId} onto family ${targetParentId}`);

    // --- Core Logic for Updating Parent ID ---
    const droppedNode = treeData.find(node => node.id === droppedNodeId);
    const targetNode = treeData.find(node => node.id === targetParentId);

    if (droppedNode && targetNode && targetNode.type === 'family') {
        // Prevent dropping a node onto itself or its own child
        if (droppedNode.id === targetNode.id) {
            console.warn("Cannot drop node onto itself.");
            return;
        }
        // Basic check to prevent dropping parent onto its own child (more robust check needed for complex trees)
        let tempParent = targetNode;
        while(tempParent) {
            if (tempParent.id === droppedNode.id) {
                console.warn("Cannot drop a parent onto its own child.");
                return;
            }
            tempParent = treeData.find(n => n.id === tempParent.parentId);
        }

        droppedNode.parentId = targetParentId;
        renderTree(); // Re-render the tree to reflect the new structure
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
    // Prompt for name and description (simple browser prompts for MVP)
    const name = prompt(`Enter ${type} name:`);
    if (!name) return; // User cancelled

    const description = prompt(`Enter description for ${name}:`);
    // description can be empty

    const imageUrl = prompt(`Enter image URL for ${name} (optional):`);
    // imageUrl can be empty

    const newNode = {
        id: generateUUID(),
        name: name.trim(),
        description: description ? description.trim() : '',
        imageUrl: imageUrl ? imageUrl.trim() : '',
        type: type,
        parentId: null // New nodes are added as root initially, drag-and-drop will move them
    };

    treeData.push(newNode);
    renderTree(); // Re-render the tree to show the new node
}

// --- Node Editing and Deletion (Placeholders for now) ---
let selectedNodeId = null; // To keep track of which node is being edited

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
        nodeToEdit.name = document.getElementById('editName').value.trim();
        nodeToEdit.description = document.getElementById('editDescription').value.trim();
        nodeToEdit.imageUrl = document.getElementById('editImageUrl').value.trim();
        nodeToEdit.type = document.getElementById('editIsSpecies').checked ? 'species' : 'family';

        // If a family node becomes a species, it can no longer have children
        // We need to detach its current children by setting their parentId to null or re-parenting
        if (nodeToEdit.type === 'species') {
            const children = treeData.filter(node => node.parentId === nodeToEdit.id);
            children.forEach(child => child.parentId = null); // Make children root nodes
        }


        renderTree(); // Re-render to show updated name/type
        // Hide panel or give feedback
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

    renderTree(); // Re-render the tree
    nodePropertiesPanel.style.display = 'none'; // Hide panel
    selectedNodeId = null; // Deselect
}


// --- Event Listeners ---

addFamilyBtn.addEventListener('click', () => createNode('family'));
addSpeciesBtn.addEventListener('click', () => createNode('species'));
saveEditBtn.addEventListener('click', saveNodeChanges);
deleteNodeBtn.addEventListener('click', deleteSelectedNode);

// Initial render when the page loads
document.addEventListener('DOMContentLoaded', renderTree); // Ensures DOM is ready
