/**
 * WhatsApp Content Feedback Simulator
 * Main Application JavaScript
 */

// ==========================================
// Agent Definitions
// ==========================================
const AGENTS = [
    {
        id: 'pxfn',
        name: 'PXFN',
        icon: '🛡️',
        fullName: 'Legal + Policy + Risk',
        prompts: [
            'Check for any policy violations or legal concerns',
            'Ensure no promotional language that could mislead users',
            'Verify data privacy language is accurate',
            'Check for regulatory compliance issues'
        ]
    },
    {
        id: 'designer',
        name: 'Designer',
        icon: '🎨',
        fullName: 'Product Designer',
        prompts: [
            'Evaluate visual hierarchy and layout',
            'Check consistency with WhatsApp Design System',
            'Verify proper use of spacing and alignment',
            'Assess overall user experience'
        ]
    },
    {
        id: 'pm',
        name: 'PM',
        icon: '📊',
        fullName: 'Product Manager',
        prompts: [
            'Verify content aligns with product goals',
            'Check for clear value proposition',
            'Ensure user flow makes sense',
            'Validate feature completeness'
        ]
    },
    {
        id: 'gtm',
        name: 'GTM',
        icon: '📣',
        fullName: 'GTM / PMM',
        prompts: [
            'Evaluate messaging for market fit',
            'Check brand voice consistency',
            'Assess localization readiness',
            'Verify call-to-action effectiveness'
        ]
    },
    {
        id: 'uxr',
        name: 'UXR',
        icon: '🔬',
        fullName: 'UX Researcher',
        prompts: [
            'Evaluate content from user perspective',
            'Check for cognitive load issues',
            'Verify comprehension and clarity',
            'Assess emotional impact'
        ]
    },
    {
        id: 'content',
        name: 'Content',
        icon: '✍️',
        fullName: 'Content Designer',
        prompts: [
            'Check grammar and spelling',
            'Verify tone matches WhatsApp voice',
            'Ensure content is concise and clear',
            'Check for localization issues (30% expansion)'
        ]
    }
];

// ==========================================
// Sample Feedback Data (Simulated)
// ==========================================
const SAMPLE_ISSUES = {
    blockers: [
        { agent: 'content', text: '"Enable now!" → "Turn on" (too promotional)' },
        { agent: 'pxfn', text: 'Remove "guaranteed" claim without verification' }
    ],
    shouldFix: [
        { agent: 'content', text: 'Shorten body text to 2 lines max' },
        { agent: 'gtm', text: 'Reduce title length for German (+30% expansion)' },
        { agent: 'designer', text: 'Increase tap target size for primary button' }
    ],
    niceToHave: [
        { agent: 'pm', text: 'Lead with value proposition in title' },
        { agent: 'uxr', text: 'Consider adding a dismiss option' },
        { agent: 'gtm', text: 'A/B test different CTA variations' }
    ],
    working: [
        'Policy compliant',
        'Uses WDS patterns',
        'Clear information hierarchy',
        'Appropriate tone'
    ]
};

// ==========================================
// DOM Elements
// ==========================================
const elements = {
    dropZone: document.getElementById('dropZone'),
    dropZoneContent: document.getElementById('dropZoneContent'),
    fileInput: document.getElementById('fileInput'),
    imagesPreview: document.getElementById('imagesPreview'),
    imageCount: document.getElementById('imageCount'),
    clearImagesBtn: document.getElementById('clearImagesBtn'),
    textInput: document.getElementById('textInput'),
    contextInput: document.getElementById('contextInput'),
    submitBtn: document.getElementById('submitBtn'),
    loadingSection: document.getElementById('loadingSection'),
    feedbackSection: document.getElementById('feedbackSection'),
    agentGrid: document.getElementById('agentGrid'),
    checklistSection: document.getElementById('checklistSection'),
    blockersCategory: document.getElementById('blockersCategory'),
    blockersList: document.getElementById('blockersList'),
    shouldFixCategory: document.getElementById('shouldFixCategory'),
    shouldFixList: document.getElementById('shouldFixList'),
    niceToHaveCategory: document.getElementById('niceToHaveCategory'),
    niceToHaveList: document.getElementById('niceToHaveList'),
    whatsWorkingCategory: document.getElementById('whatsWorkingCategory'),
    workingList: document.getElementById('workingList'),
    copyBtn: document.getElementById('copyBtn'),
    resetBtn: document.getElementById('resetBtn')
};

// ==========================================
// State
// ==========================================
let uploadedImages = []; // Array of base64 images
let feedbackData = null;

// ==========================================
// Utility Functions
// ==========================================
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function generateFeedback(textContent, context) {
    // Simulate AI feedback generation
    // In a real implementation, this would call an AI API

    const hasImage = uploadedImage !== null;
    const hasText = textContent && textContent.trim().length > 0;

    // Generate agent-specific feedback
    const agentFeedback = AGENTS.map(agent => {
        const issues = [];
        const details = [];

        // Simulate different feedback based on content analysis
        if (textContent) {
            // Content analysis simulation
            if (agent.id === 'content') {
                if (textContent.toLowerCase().includes('enable now') ||
                    textContent.toLowerCase().includes('act now') ||
                    textContent.includes('!')) {
                    issues.push({ severity: 'blocker', text: 'Avoid promotional language like "Enable now!" - use "Turn on" instead' });
                }
                if (textContent.length > 150) {
                    issues.push({ severity: 'shouldFix', text: 'Body text is too long. Keep to 2 lines (80-100 characters)' });
                }
                if (textContent.split(' ').some(word => word.length > 15)) {
                    issues.push({ severity: 'niceToHave', text: 'Consider breaking up long words for better readability' });
                }
                details.push('Voice and tone match WhatsApp guidelines');
                details.push('Grammar and spelling are correct');
            }

            if (agent.id === 'pxfn') {
                if (textContent.toLowerCase().includes('guaranteed') ||
                    textContent.toLowerCase().includes('100%') ||
                    textContent.toLowerCase().includes('always')) {
                    issues.push({ severity: 'blocker', text: 'Avoid absolute claims without verification' });
                }
                if (textContent.toLowerCase().includes('free')) {
                    issues.push({ severity: 'shouldFix', text: 'Verify "free" claim is accurate for all markets' });
                }
                details.push('No obvious policy violations detected');
            }

            if (agent.id === 'a11y') {
                if (hasImage && !textContent.toLowerCase().includes('alt')) {
                    issues.push({ severity: 'shouldFix', text: 'Ensure all images have descriptive alt text' });
                }
                details.push('Text appears to have sufficient contrast');
                details.push('Consider screen reader announcements for state changes');
            }

            if (agent.id === 'gtm') {
                const wordCount = textContent.split(' ').length;
                if (wordCount > 20) {
                    issues.push({ severity: 'shouldFix', text: 'Allow 30% expansion for localization in title/body' });
                }
                details.push('Messaging is clear for target audience');
            }

            if (agent.id === 'eng') {
                const lines = textContent.split('\n');
                lines.forEach(line => {
                    if (line.length > 50) {
                        issues.push({ severity: 'shouldFix', text: `Line exceeds recommended character limit: "${line.substring(0, 30)}..."` });
                    }
                });
                details.push('No dynamic value issues detected');
            }

            if (agent.id === 'designer') {
                details.push('Layout follows WDS patterns');
                if (!hasImage) {
                    issues.push({ severity: 'niceToHave', text: 'Consider adding visual element to support the message' });
                }
            }

            if (agent.id === 'pm') {
                details.push('Feature flow is logical');
                if (!textContent.toLowerCase().includes('you') && !textContent.toLowerCase().includes('your')) {
                    issues.push({ severity: 'niceToHave', text: 'Consider user-centric language (use "you/your")' });
                }
            }

            if (agent.id === 'uxr') {
                details.push('Cognitive load appears manageable');
                if (textContent.split('\n').length > 5) {
                    issues.push({ severity: 'shouldFix', text: 'Consider reducing information density' });
                }
            }
        }

        // Add default feedback if no specific issues
        if (issues.length === 0 && details.length === 0) {
            details.push('No issues detected');
            details.push('Content appears to meet guidelines');
        }

        return {
            ...agent,
            issues,
            details,
            hasBlockers: issues.some(i => i.severity === 'blocker'),
            issueCount: issues.length
        };
    });

    // Aggregate issues for checklist
    const blockers = [];
    const shouldFix = [];
    const niceToHave = [];
    const working = [];

    agentFeedback.forEach(agent => {
        agent.issues.forEach(issue => {
            const item = { agent: agent.id, agentName: agent.name, text: issue.text };
            if (issue.severity === 'blocker') blockers.push(item);
            else if (issue.severity === 'shouldFix') shouldFix.push(item);
            else niceToHave.push(item);
        });

        agent.details.forEach(detail => {
            if (!working.includes(detail)) {
                working.push(detail);
            }
        });
    });

    return {
        agents: agentFeedback,
        checklist: {
            blockers,
            shouldFix,
            niceToHave,
            working: working.slice(0, 5) // Limit to 5 items
        }
    };
}

// ==========================================
// UI Functions
// ==========================================
function renderAgentCards(agents) {
    elements.agentGrid.innerHTML = '';

    agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.dataset.agentId = agent.id;

        let statusClass = 'no-issues';
        let statusIcon = '✅';
        let statusText = 'Looks good';

        if (agent.hasBlockers) {
            statusClass = 'has-blockers';
            statusIcon = '🔴';
            statusText = `${agent.issueCount} blocker${agent.issueCount > 1 ? 's' : ''}`;
        } else if (agent.issueCount > 0) {
            statusClass = 'has-issues';
            statusIcon = '⚠️';
            statusText = `${agent.issueCount} issue${agent.issueCount > 1 ? 's' : ''}`;
        }

        // Handle both 'details' (old format) and 'positive' (new API format)
        const positiveItems = agent.positive || agent.details || [];

        // Separate issues by severity
        const blockers = agent.issues.filter(i => i.severity === 'blocker');
        const shouldFix = agent.issues.filter(i => i.severity === 'shouldFix');
        const niceToHave = agent.issues.filter(i => i.severity === 'niceToHave');

        // Build issues HTML with severity sections - using bullet lists
        let issuesHtml = '';
        if (blockers.length > 0) {
            issuesHtml += `
                <div class="issue-section blocker-section">
                    <div class="issue-section-header">
                        <span class="issue-icon">🔴</span>
                        <span class="issue-label">Blockers</span>
                    </div>
                    <ul class="issue-list">
                        ${blockers.map(issue => `
                            <li class="issue-item blocker">${issue.text}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        if (shouldFix.length > 0) {
            issuesHtml += `
                <div class="issue-section should-fix-section">
                    <div class="issue-section-header">
                        <span class="issue-icon">🟡</span>
                        <span class="issue-label">Should Fix</span>
                    </div>
                    <ul class="issue-list">
                        ${shouldFix.map(issue => `
                            <li class="issue-item should-fix">${issue.text}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        if (niceToHave.length > 0) {
            issuesHtml += `
                <div class="issue-section nice-to-have-section">
                    <div class="issue-section-header">
                        <span class="issue-icon">🟢</span>
                        <span class="issue-label">Nice to Have</span>
                    </div>
                    <ul class="issue-list">
                        ${niceToHave.map(issue => `
                            <li class="issue-item nice-to-have">${issue.text}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        // Build positive feedback HTML - using bullet lists
        let positiveHtml = '';
        if (positiveItems.length > 0) {
            positiveHtml = `
                <div class="positive-section">
                    <div class="positive-section-header">
                        <span class="positive-icon">✅</span>
                        <span class="positive-label">What's Working</span>
                    </div>
                    <ul class="positive-list">
                        ${positiveItems.map(item => `
                            <li class="positive-item">${item}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="agent-card-header">
                <div class="agent-card-header-left" data-expert="${agent.name}">
                    <span class="agent-icon">${agent.icon}</span>
                    <span class="agent-name">${agent.name}</span>
                </div>
                <div class="agent-status ${statusClass}">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}</span>
                </div>
            </div>
            <div class="agent-details">
                ${issuesHtml}
                ${issuesHtml && positiveHtml ? '<div class="feedback-divider"></div>' : ''}
                ${positiveHtml}
            </div>
        `;

        // Add click handler to open experts modal for this specific expert
        const headerLeft = card.querySelector('.agent-card-header-left');
        headerLeft.addEventListener('click', () => {
            openExpertModal(agent.name);
        });

        // Cards show all content by default - no expand/collapse needed
        elements.agentGrid.appendChild(card);
    });
}

function renderChecklist(checklist) {
    let itemNumber = 1;

    // Render blockers
    if (checklist.blockers.length > 0) {
        elements.blockersCategory.hidden = false;
        elements.blockersList.innerHTML = checklist.blockers.map(item => `
            <div class="checklist-item">
                <input type="checkbox" id="item-${itemNumber}" onchange="toggleChecklistItem(this)">
                <span class="checklist-item-text">${itemNumber++}. ${item.text}</span>
            </div>
        `).join('');
    } else {
        elements.blockersCategory.hidden = true;
    }

    // Render should fix
    if (checklist.shouldFix.length > 0) {
        elements.shouldFixCategory.hidden = false;
        elements.shouldFixList.innerHTML = checklist.shouldFix.map(item => `
            <div class="checklist-item">
                <input type="checkbox" id="item-${itemNumber}" onchange="toggleChecklistItem(this)">
                <span class="checklist-item-text">${itemNumber++}. ${item.text}</span>
            </div>
        `).join('');
    } else {
        elements.shouldFixCategory.hidden = true;
    }

    // Render nice to have
    if (checklist.niceToHave.length > 0) {
        elements.niceToHaveCategory.hidden = false;
        elements.niceToHaveList.innerHTML = checklist.niceToHave.map(item => `
            <div class="checklist-item">
                <input type="checkbox" id="item-${itemNumber}" onchange="toggleChecklistItem(this)">
                <span class="checklist-item-text">${itemNumber++}. ${item.text}</span>
            </div>
        `).join('');
    } else {
        elements.niceToHaveCategory.hidden = true;
    }

    // Render what's working
    if (checklist.working.length > 0) {
        elements.whatsWorkingCategory.hidden = false;
        elements.workingList.innerHTML = checklist.working.map(item => `
            <span class="working-item">${item}</span>
        `).join('');
    } else {
        elements.whatsWorkingCategory.hidden = true;
    }
}

function toggleChecklistItem(checkbox) {
    const item = checkbox.closest('.checklist-item');
    if (checkbox.checked) {
        item.classList.add('checked');
    } else {
        item.classList.remove('checked');
    }
}

// Make it globally available
window.toggleChecklistItem = toggleChecklistItem;

function generateChecklistText() {
    const lines = [];
    lines.push('# Content Feedback Checklist\n');

    if (feedbackData.checklist.blockers.length > 0) {
        lines.push('## 🔴 BLOCKERS');
        feedbackData.checklist.blockers.forEach((item, i) => {
            lines.push(`- [ ] ${i + 1}. ${item.text}`);
        });
        lines.push('');
    }

    let count = feedbackData.checklist.blockers.length;

    if (feedbackData.checklist.shouldFix.length > 0) {
        lines.push('## 🟡 SHOULD FIX');
        feedbackData.checklist.shouldFix.forEach((item, i) => {
            lines.push(`- [ ] ${count + i + 1}. ${item.text}`);
        });
        lines.push('');
    }

    count += feedbackData.checklist.shouldFix.length;

    if (feedbackData.checklist.niceToHave.length > 0) {
        lines.push('## 🟢 NICE TO HAVE');
        feedbackData.checklist.niceToHave.forEach((item, i) => {
            lines.push(`- [ ] ${count + i + 1}. ${item.text}`);
        });
        lines.push('');
    }

    if (feedbackData.checklist.working.length > 0) {
        lines.push("## ✅ WHAT'S WORKING");
        feedbackData.checklist.working.forEach(item => {
            lines.push(`• ${item}`);
        });
    }

    return lines.join('\n');
}

function resetForm() {
    // Clear inputs
    elements.textInput.value = '';
    elements.contextInput.value = '';

    // Clear images
    uploadedImages = [];
    updateImagesPreview();

    // Hide sections
    elements.feedbackSection.hidden = true;
    elements.checklistSection.hidden = true;

    // Clear feedback
    elements.agentGrid.innerHTML = '';
    elements.blockersList.innerHTML = '';
    elements.shouldFixList.innerHTML = '';
    elements.niceToHaveList.innerHTML = '';
    elements.workingList.innerHTML = '';

    feedbackData = null;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// Image Handling Functions
// ==========================================
function updateImagesPreview() {
    elements.imagesPreview.innerHTML = '';

    if (uploadedImages.length > 0) {
        elements.dropZone.classList.add('has-images');
        elements.clearImagesBtn.hidden = false;
        elements.imageCount.textContent = `${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}`;

        uploadedImages.forEach((imgData, index) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.innerHTML = `
                <img src="${imgData}" alt="Screen ${index + 1}">
                <span class="image-number">${index + 1}</span>
                <button class="remove-image" data-index="${index}">×</button>
            `;

            // Click on image to open lightbox
            item.querySelector('img').addEventListener('click', (e) => {
                e.stopPropagation();
                openLightbox(index);
            });

            elements.imagesPreview.appendChild(item);
        });

        // Add click handlers for remove buttons
        elements.imagesPreview.querySelectorAll('.remove-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                removeImage(index);
            });
        });
    } else {
        elements.dropZone.classList.remove('has-images');
        elements.clearImagesBtn.hidden = true;
        elements.imageCount.textContent = '';
    }
}

function addImage(base64Data) {
    uploadedImages.push(base64Data);
    updateImagesPreview();
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    updateImagesPreview();
}

function clearAllImages() {
    uploadedImages = [];
    updateImagesPreview();
    elements.fileInput.value = '';
}

function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        addImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function handleMultipleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            handleImageUpload(file);
        }
    });
}

// ==========================================
// Event Handlers
// ==========================================

// Drop Zone - Click to upload
elements.dropZone.addEventListener('click', (e) => {
    if (!e.target.classList.contains('remove-image')) {
        elements.fileInput.click();
    }
});

// Drop Zone - Drag and drop
elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('drag-over');
});

elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('drag-over');
});

elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');

    if (e.dataTransfer.files.length > 0) {
        handleMultipleFiles(e.dataTransfer.files);
        showToast(`${e.dataTransfer.files.length} image${e.dataTransfer.files.length > 1 ? 's' : ''} added`);
    }
});

// File input change (supports multiple)
elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleMultipleFiles(e.target.files);
        showToast(`${e.target.files.length} image${e.target.files.length > 1 ? 's' : ''} added`);
    }
});

// Clear all images button
elements.clearImagesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllImages();
    showToast('All images cleared');
});

// Paste image from clipboard (Ctrl+V / Cmd+V)
document.addEventListener('paste', (e) => {
    // Check if user is typing in a text field - allow normal paste there
    const activeElement = document.activeElement;
    const isTextInput = activeElement.tagName === 'TEXTAREA' ||
                        activeElement.tagName === 'INPUT' ||
                        activeElement.isContentEditable;

    // Check if clipboard has image data
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    for (const item of clipboardItems) {
        if (item.type.startsWith('image/')) {
            // Prevent default paste behavior
            e.preventDefault();

            const file = item.getAsFile();
            if (file) {
                handleImageUpload(file);
                showToast('Image pasted! Keep pasting to add more screens.');

                // Scroll to the drop zone to show the pasted image
                elements.dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
    }
});

// API Configuration - always use localhost:5001 for the backend server
const API_BASE_URL = 'http://localhost:5001';

// Loading messages and expert cycling
const LOADING_MESSAGES = [
    { text: "Analyzing your content...", subtext: "Getting feedback from 6 expert perspectives" },
    { text: "Scanning for issues...", subtext: "Checking against WhatsApp guidelines" },
    { text: "Almost there...", subtext: "Compiling expert recommendations" },
    { text: "Finalizing feedback...", subtext: "Preparing your personalized checklist" }
];

const EXPERT_MESSAGES = [
    { icon: "🛡️", name: "PXFN", action: "checking policy compliance..." },
    { icon: "🎨", name: "Designer", action: "reviewing visual hierarchy..." },
    { icon: "📊", name: "PM", action: "evaluating user flow..." },
    { icon: "📣", name: "GTM", action: "checking localization readiness..." },
    { icon: "🔬", name: "UXR", action: "analyzing user comprehension..." },
    { icon: "✍️", name: "Content", action: "reviewing voice & tone..." }
];

let loadingInterval = null;
let expertInterval = null;
let progressInterval = null;

function startLoadingAnimation() {
    const loadingText = document.getElementById('loadingText');
    const loadingSubtext = document.getElementById('loadingSubtext');
    const loadingExpert = document.getElementById('loadingExpert');
    const loadingProgressBar = document.getElementById('loadingProgressBar');

    let expertIndex = 0;
    let progress = 0;
    let elapsed = 0;
    const expectedDuration = 15000; // Expected ~15 seconds for parallel API calls + deduplication

    // Reset progress bar
    loadingProgressBar.style.width = '0%';

    // Set static title and subtitle (no rotation)
    loadingText.textContent = "Analyzing your content...";
    loadingSubtext.textContent = "Getting feedback from 6 expert perspectives";

    // Only cycle through experts (bottom text)
    expertInterval = setInterval(() => {
        expertIndex = (expertIndex + 1) % EXPERT_MESSAGES.length;
        const expert = EXPERT_MESSAGES[expertIndex];
        loadingExpert.textContent = `${expert.icon} ${expert.name} is ${expert.action}`;
    }, 1500);

    // Animate progress bar with realistic timing
    // Use easing function to slow down as it approaches 90%
    progressInterval = setInterval(() => {
        elapsed += 200;

        // Calculate progress based on elapsed time with easing
        // Progress follows a curve: fast at start, slows down toward end
        const normalizedTime = Math.min(elapsed / expectedDuration, 1);

        // Ease-out curve: starts fast, slows down
        // Caps at 90% until actual completion
        const targetProgress = 90 * (1 - Math.pow(1 - normalizedTime, 2));

        // Smoothly approach target
        progress = progress + (targetProgress - progress) * 0.1;

        if (progress > 90) progress = 90;
        loadingProgressBar.style.width = `${progress}%`;
    }, 200);
}

function stopLoadingAnimation() {
    const loadingProgressBar = document.getElementById('loadingProgressBar');

    // Complete the progress bar
    loadingProgressBar.style.width = '100%';

    // Clear all intervals
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    if (expertInterval) {
        clearInterval(expertInterval);
        expertInterval = null;
    }
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

// Submit button
elements.submitBtn.addEventListener('click', async () => {
    const textContent = elements.textInput.value.trim();
    const context = elements.contextInput.value.trim();

    if (!textContent && uploadedImages.length === 0) {
        showToast('Please upload an image or enter text');
        return;
    }

    // Show loading
    elements.loadingSection.hidden = false;
    elements.feedbackSection.hidden = true;
    elements.checklistSection.hidden = true;
    elements.submitBtn.disabled = true;

    // Start loading animation
    startLoadingAnimation();

    // Scroll to loading
    elements.loadingSection.scrollIntoView({ behavior: 'smooth' });

    try {
        // Call the backend API
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: textContent,
                context: context,
                images: uploadedImages // Send array of images
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to analyze content');
        }

        feedbackData = await response.json();

        // Stop loading animation
        stopLoadingAnimation();

        // Render results
        renderAgentCards(feedbackData.agents);
        renderChecklist(feedbackData.checklist);

        // Show results
        elements.loadingSection.hidden = true;
        elements.feedbackSection.hidden = false;
        elements.checklistSection.hidden = false;

        // Scroll to feedback
        elements.feedbackSection.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Error analyzing content:', error);
        stopLoadingAnimation();
        elements.loadingSection.hidden = true;
        showToast(`Error: ${error.message}`);
    } finally {
        elements.submitBtn.disabled = false;
    }
});

// Copy checklist
elements.copyBtn.addEventListener('click', async () => {
    if (!feedbackData) return;

    const checklistText = generateChecklistText();

    try {
        await navigator.clipboard.writeText(checklistText);
        showToast('Checklist copied to clipboard!');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = checklistText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Checklist copied to clipboard!');
    }
});

// Reset button
elements.resetBtn.addEventListener('click', resetForm);

// ==========================================
// Initialize
// ==========================================
console.log('WhatsApp Content Feedback Simulator loaded');

// ==========================================
// Lightbox Functions
// ==========================================
let currentLightboxIndex = 0;

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');

function openLightbox(index) {
    currentLightboxIndex = index;
    updateLightbox();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

function updateLightbox() {
    if (uploadedImages.length === 0) {
        closeLightbox();
        return;
    }

    lightboxImage.src = uploadedImages[currentLightboxIndex];
    lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${uploadedImages.length}`;

    // Update nav button states
    lightboxPrev.disabled = currentLightboxIndex === 0;
    lightboxNext.disabled = currentLightboxIndex === uploadedImages.length - 1;

    // Hide nav buttons if only one image
    if (uploadedImages.length <= 1) {
        lightboxPrev.style.display = 'none';
        lightboxNext.style.display = 'none';
        lightboxCounter.style.display = 'none';
    } else {
        lightboxPrev.style.display = 'flex';
        lightboxNext.style.display = 'flex';
        lightboxCounter.style.display = 'block';
    }
}

function showPrevImage() {
    if (currentLightboxIndex > 0) {
        currentLightboxIndex--;
        updateLightbox();
    }
}

function showNextImage() {
    if (currentLightboxIndex < uploadedImages.length - 1) {
        currentLightboxIndex++;
        updateLightbox();
    }
}

// Lightbox event listeners
lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', showPrevImage);
lightboxNext.addEventListener('click', showNextImage);

// Close lightbox on background click
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        closeLightbox();
    }
});

// Keyboard navigation for lightbox
document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;

    switch (e.key) {
        case 'Escape':
            closeLightbox();
            break;
        case 'ArrowLeft':
            showPrevImage();
            break;
        case 'ArrowRight':
            showNextImage();
            break;
    }
});

// Make openLightbox globally available
window.openLightbox = openLightbox;

// ==========================================
// Meet the Experts Modal
// ==========================================
const expertsModal = document.getElementById('expertsModal');
const meetExpertsBtn = document.getElementById('meetExpertsBtn');
const expertsModalClose = document.getElementById('expertsModalClose');

console.log('Modal elements:', { expertsModal, meetExpertsBtn, expertsModalClose });

/**
 * Opens the experts modal and optionally highlights a specific expert
 * @param {string|null} expertName - The name of the expert to highlight (e.g., "PXFN", "Designer")
 */
function openExpertModal(expertName = null) {
    if (!expertsModal) return;

    // Remove any existing highlights
    const allExpertCards = expertsModal.querySelectorAll('.expert-card');
    allExpertCards.forEach(card => card.classList.remove('highlighted'));

    // Open the modal
    expertsModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // If an expert name is provided, highlight and scroll to that expert
    if (expertName) {
        const targetCard = expertsModal.querySelector(`.expert-card[data-expert="${expertName}"]`);
        if (targetCard) {
            // Highlight the card
            targetCard.classList.add('highlighted');

            // Scroll to the card after a brief delay to ensure modal is visible
            setTimeout(() => {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

// Make openExpertModal globally available for feedback cards
window.openExpertModal = openExpertModal;

if (expertsModal && meetExpertsBtn && expertsModalClose) {
    meetExpertsBtn.addEventListener('click', function() {
        console.log('Meet Experts clicked');
        openExpertModal(); // Open without highlighting any specific expert
    });

    expertsModalClose.addEventListener('click', function() {
        expertsModal.classList.remove('active');
        document.body.style.overflow = '';
        // Remove highlights when closing
        const highlightedCards = expertsModal.querySelectorAll('.expert-card.highlighted');
        highlightedCards.forEach(card => card.classList.remove('highlighted'));
    });

    // Close on background click
    expertsModal.addEventListener('click', function(e) {
        if (e.target === expertsModal) {
            expertsModal.classList.remove('active');
            document.body.style.overflow = '';
            // Remove highlights when closing
            const highlightedCards = expertsModal.querySelectorAll('.expert-card.highlighted');
            highlightedCards.forEach(card => card.classList.remove('highlighted'));
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && expertsModal.classList.contains('active')) {
            expertsModal.classList.remove('active');
            document.body.style.overflow = '';
            // Remove highlights when closing
            const highlightedCards = expertsModal.querySelectorAll('.expert-card.highlighted');
            highlightedCards.forEach(card => card.classList.remove('highlighted'));
        }
    });

    console.log('✅ Meet the Experts modal initialized');
} else {
    console.error('❌ Meet the Experts modal elements not found:', {
        modal: !!expertsModal,
        btn: !!meetExpertsBtn,
        close: !!expertsModalClose
    });
}
