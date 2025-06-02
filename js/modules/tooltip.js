// js/modules/tooltip.js

let tooltipElement;
let popupNameElement;
let popupDescriptionElement;
let popupImageElement;
let popupCloseButtonElement;

// This function ensures the tooltip DOM elements are found/created and initialized
function initializeTooltipElements() {
    if (tooltipElement) {
        return true; // Already initialized
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

    // Add the close button listener here once the button is found
    popupCloseButtonElement.addEventListener('click', hideTooltip);
    console.log("DEBUG: Tooltip elements initialized and close button listener attached.");
    return true;
}

export function showTooltip(nodeData) {
    if (!initializeTooltipElements()) {
        return; // Exit if initialization failed
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
    console.log("DEBUG: Tooltip displayed for node:", nodeData.name, "Description:", nodeData.description);
}

export function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
    document.body.classList.remove('popup-active');
    console.log("DEBUG: Tooltip hidden.");
}
