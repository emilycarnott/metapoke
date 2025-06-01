// js/modules/tooltip.js

// Global variable to hold the tooltip DOM element
let tooltipElement;

// This function creates the tooltip div if it doesn't already exist
function createTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.id = 'node-info-popup'; // Use the ID from our HTML plan
        tooltipElement.classList.add('node-info-popup');
        // Add other inner HTML elements now, or let showTooltip populate them later
        tooltipElement.innerHTML = `
            <h3 id="popup-name"></h3>
            <p id="popup-description"></p>
            <img id="popup-image" src="" alt="Node Image" style="display: none;">
            <button id="popup-close-btn">Close</button>
        `;
        document.body.appendChild(tooltipElement);

        // Add the close button listener here once the button is created
        document.getElementById('popup-close-btn').addEventListener('click', hideTooltip);
    }
}

// Function to show the tooltip with node information
export function showTooltip(nodeData) {
    // Ensure the tooltip element exists
    createTooltipElement();

    document.getElementById('popup-name').textContent = nodeData.name;
    document.getElementById('popup-description').textContent = nodeData.description || 'No description available.';

    const popupImage = document.getElementById('popup-image');
    if (nodeData.imageUrl) {
        popupImage.src = nodeData.imageUrl;
        popupImage.style.display = 'block'; // Show the image
    } else {
        popupImage.src = ''; // Clear image source
        popupImage.style.display = 'none'; // Hide the image element
    }

    tooltipElement.style.display = 'block'; // Make the tooltip visible
    document.body.classList.add('popup-active'); // Add class to body for potential overflow hidden
}

// Function to hide the tooltip
export function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
    document.body.classList.remove('popup-active'); // Remove class from body
}
