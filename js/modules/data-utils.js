// js/modules/data-utils.js

export function convertNestedToFlat(nestedNodes, parentId = null) {
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

        if (node.children && node.children.length > 0) {
            flatList = flatList.concat(convertNestedToFlat(node.children, newNode.id));
        }
    });
    return flatList;
}

export function findNodeById(id, flatTree) {
    return flatTree.find(node => node.id === id);
}

export function findNodeByName(name, flatTree) {
    return flatTree.find(node => node.name.toLowerCase() === name.toLowerCase());
}

export function getPathToRoot(nodeId, flatTree) {
    const path = [];
    let currentNode = findNodeById(nodeId, flatTree);
    while (currentNode) {
        path.unshift(currentNode.id);
        currentNode = findNodeById(currentNode.parentId, flatTree);
    }
    return path;
}

export function findLowestCommonAncestor(node1Id, node2Id, flatTree) {
    if (!node1Id || !node2Id) return null;

    const path1 = getPathToRoot(node1Id, flatTree);
    const path2 = getPathToRoot(node2Id, flatTree);

    let lcaId = null;
    for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if (path1[i] === path2[i]) {
            lcaId = path1[i];
        } else {
            break;
        }
    }
    return lcaId;
}
