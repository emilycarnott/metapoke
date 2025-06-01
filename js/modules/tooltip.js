// js/modules/tooltip.js

let tooltipElement;
let popupNameElement;
let popupDescriptionElement;
let popupImageElement;
let popupCloseButtonElement;

function initializeTooltipElements() {
    if (tooltipElement) {
        return true;
    }

    tooltipElement = document.getElementById('node-info-popup');
    if (!tooltipElement) {
        console.error("Error: #node-info-popup element not found in HTML. Did you add it to index.html?");
        return false;
    }

    popupNameElement = document.getElementById('popup-name');
    popupDescriptionElement = document.getElementById('popup-description');
    popupImageElement = document.getElementById('popup-image');
    popupCloseButtonElement = document.getElementById('popup-close-btn');

    if (!popupNameElement || !popupDescriptionElement || !popupImageElement || !popupCloseButtonElement) {
        console.error("Error: Missing sub-elements within #node-info-popup. Check IDs in index.html (popup-name, popup-description, popup-image, popup-close-btn).");
        return false;
    }

    popupCloseButtonElement.addEventListener('click', hideTooltip);
    console.log("Tooltip elements initialized and close button listener attached.");
    return true;
}

export function showTooltip(nodeData) {
    if (!initializeTooltipElements()) {
        return;
    }

    popupNameElement.textContent = nodeData.name;
    popupDescriptionElement.textContent = nodeData.description || 'No description available.';

    if (nodeData.imageUrl) {
        popupImageElement.src = nodeData.imageUrl;
        popupImageElement.style.display = 'block';
    } else {
        popupImageElement.src = '';
        popupImageElement.style.display = 'none';
    }

    tooltipElement.style.display = 'block';
    document.body.classList.add('popup-active');
    console.log("Tooltip displayed for node:", nodeData.name, "Description:", nodeData.description);
}

export function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
    document.body.classList.remove('popup-active');
    console.log("Tooltip hidden.");
}
