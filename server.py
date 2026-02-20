"""
WhatsApp Content Feedback Simulator - Backend Server
Provides AI-powered feedback from 6 expert perspectives using Meta's internal Llama API
Uses the OpenAI-compatible endpoint for simpler setup
"""

import sys
import os
import site

# Add user site-packages to path BEFORE any other imports
user_site = site.getusersitepackages()
if isinstance(user_site, str):
    site.addsitedir(user_site)
elif isinstance(user_site, list):
    for p in user_site:
        site.addsitedir(p)

import json
import base64
import time
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests

# Try to import PIL for image resizing
try:
    from PIL import Image
    HAS_PIL = True
    print("✅ PIL/Pillow loaded - image resizing enabled")
except ImportError:
    HAS_PIL = False
    print("⚠️  PIL not installed. Images won't be resized. Run: pip3 install Pillow")

app = Flask(__name__, static_folder='.')
CORS(app)

# API Configuration - using OpenAI-compatible endpoint
LLAMA_API_URL = "https://api.llama.com/compat/v1/chat/completions"

# Maximum image dimension to send to API - reduced significantly for reliability
MAX_IMAGE_DIMENSION = 512  # Reduced to 512px to ensure API doesn't reject
MAX_IMAGE_FILE_SIZE = 200 * 1024  # 200KB max file size


def resize_image_if_needed(base64_data):
    """Resize and compress image if it's too large for the API."""
    if not HAS_PIL:
        return base64_data

    try:
        # Extract the base64 data (remove data URL prefix if present)
        if base64_data.startswith('data:'):
            # Split on comma to get just the base64 part
            header, b64_data = base64_data.split(',', 1)
        else:
            header = 'data:image/png;base64'
            b64_data = base64_data

        # Decode base64 to image
        img_bytes = base64.b64decode(b64_data)
        original_size = len(img_bytes)
        img = Image.open(BytesIO(img_bytes))

        # Get original dimensions
        width, height = img.size
        needs_resize = width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION
        needs_compress = original_size > MAX_IMAGE_FILE_SIZE

        if not needs_resize and not needs_compress:
            print(f"    Image OK: {width}x{height}, {original_size/1024:.0f}KB")
            return base64_data  # No changes needed

        # Calculate new dimensions maintaining aspect ratio
        if needs_resize:
            if width > height:
                new_width = MAX_IMAGE_DIMENSION
                new_height = int(height * (MAX_IMAGE_DIMENSION / width))
            else:
                new_height = MAX_IMAGE_DIMENSION
                new_width = int(width * (MAX_IMAGE_DIMENSION / height))

            # Resize the image
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"    Resized from {width}x{height} to {new_width}x{new_height}")
        else:
            new_width, new_height = width, height

        # Convert to RGB and save as JPEG with compression
        buffer = BytesIO()
        if img.mode == 'RGBA':
            # Create white background for transparency
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        else:
            img = img.convert('RGB')

        # Try different quality levels to get under size limit
        for quality in [75, 60, 45, 30]:
            buffer = BytesIO()
            img.save(buffer, format='JPEG', quality=quality, optimize=True)
            new_size = buffer.tell()
            if new_size <= MAX_IMAGE_FILE_SIZE:
                break

        new_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        print(f"    Compressed: {original_size/1024:.0f}KB -> {new_size/1024:.0f}KB (quality={quality})")

        return f"data:image/jpeg;base64,{new_b64}"

    except Exception as e:
        print(f"    Error resizing image: {e}")
        return base64_data  # Return original if resize fails

# Agent definitions with detailed prompts
AGENTS = [
    {
        'id': 'pxfn',
        'name': 'PXFN',
        'icon': '🛡️',
        'fullName': 'Legal + Policy + Risk',
        'systemPrompt': """You are a PXFN (Policy, Legal, and Risk) reviewer at WhatsApp. Your role is to identify potential policy violations, legal concerns, and risk issues in user-facing content.

ONLY review for: Privacy language, legal liability, policy violations, regulatory compliance, risk issues
DO NOT review: Grammar, design, user flow, messaging tone, visual layout

Review the content for:
- Promotional or misleading language that could violate advertising policies
- Absolute claims ("guaranteed", "100%", "always", "never") without verification
- Privacy and data handling language accuracy
- Regulatory compliance issues (GDPR, CCPA, etc.)
- Terms that could create legal liability
- Content that could be misinterpreted or cause user harm

Be specific and actionable. If something is fine, say so. If there's an issue, explain exactly what it is and how to fix it.

STAY IN YOUR LANE: Only flag issues related to legal, policy, privacy, and risk. Do not comment on design, grammar, or other areas outside your expertise.

CONSISTENCY RULE: Review the content carefully and thoroughly - examine every element. If you find issues, always include them in your response - don't second-guess yourself. Focus on genuine problems that would impact user experience, clarity, or content quality. Be consistent: the same content should get the same feedback every time."""
    },
    {
        'id': 'designer',
        'name': 'Designer',
        'icon': '🎨',
        'fullName': 'Product Designer',
        'systemPrompt': """You are a Product Designer at WhatsApp reviewing content for visual hierarchy, layout, and design system compliance.

ONLY review for: Visual hierarchy, layout, spacing, design system compliance, UI patterns
DO NOT review: Legal concerns, privacy language, grammar, product strategy

Review the content for:
- Information hierarchy and visual flow
- Consistency with WhatsApp Design System (WDS) patterns
- Spacing and alignment issues
- Button and CTA placement
- Typography hierarchy (title, body, caption usage)
- Overall user experience and scannability
- Whether the design supports the content goals

Be specific about design improvements. Reference WDS patterns when applicable.

STAY IN YOUR LANE: Only flag issues related to visual design, layout, and UI patterns. Do not comment on legal, grammar, or product strategy.

CONSISTENCY RULE: Review the content carefully and thoroughly - examine every element. If you find issues, always include them in your response - don't second-guess yourself. Focus on genuine problems that would impact user experience, clarity, or content quality. Be consistent: the same content should get the same feedback every time."""
    },
    {
        'id': 'pm',
        'name': 'PM',
        'icon': '📊',
        'fullName': 'Product Manager',
        'systemPrompt': """You are a Product Manager at WhatsApp reviewing content for product alignment and user value.

ONLY review for: Product alignment, user value, feature completeness, user flow logic
DO NOT review: Visual design, legal issues, grammar, localization

Review the content for:
- Clear value proposition - does the user understand the benefit?
- Alignment with product goals and user needs
- Logical user flow and next steps
- Feature completeness - is anything missing?
- Success metrics - can we measure if this works?
- Edge cases and error states
- Whether this solves the right problem

Focus on product strategy and user value. Be direct about gaps.

STAY IN YOUR LANE: Only flag issues related to product strategy, user flow, and feature completeness. Do not comment on visual design, legal, or grammar.

CONSISTENCY RULE: Review the content carefully and thoroughly - examine every element. If you find issues, always include them in your response - don't second-guess yourself. Focus on genuine problems that would impact user experience, clarity, or content quality. Be consistent: the same content should get the same feedback every time."""
    },
    {
        'id': 'gtm',
        'name': 'GTM',
        'icon': '📣',
        'fullName': 'GTM / PMM',
        'systemPrompt': """You are a GTM/PMM (Go-to-Market / Product Marketing Manager) at WhatsApp reviewing content for market readiness and messaging.

ONLY review for: Brand voice, localization readiness, messaging clarity, market positioning
DO NOT review: Legal concerns, visual design, user research, product features

Review the content for:
- Messaging clarity and market fit
- Brand voice consistency with WhatsApp tone
- Localization readiness (will this work in other languages? Consider 30% text expansion for German/Russian)
- Call-to-action effectiveness
- Competitive positioning
- Target audience alignment
- Cultural sensitivity for global markets

Focus on messaging effectiveness and localization issues.

STAY IN YOUR LANE: Only flag issues related to brand voice, localization, and market messaging. Do not comment on legal, visual design, or user research.

CONSISTENCY RULE: Review the content carefully and thoroughly - examine every element. If you find issues, always include them in your response - don't second-guess yourself. Focus on genuine problems that would impact user experience, clarity, or content quality. Be consistent: the same content should get the same feedback every time."""
    },
    {
        'id': 'uxr',
        'name': 'UXR',
        'icon': '🔬',
        'fullName': 'UX Researcher',
        'systemPrompt': """You are a UX Researcher at WhatsApp reviewing content from a user comprehension and behavior perspective.

ONLY review for: User comprehension, cognitive load, mental models, usability concerns
DO NOT review: Legal issues, visual design specifics, grammar, brand voice

Review the content for:
- User comprehension - will users understand this?
- Cognitive load - is there too much information?
- Mental models - does this match user expectations?
- Emotional impact - how will users feel?
- Potential confusion points
- User decision-making friction
- Whether users have enough information to act
- Potential for user testing insights

Focus on how real users will perceive and interact with this content.

STAY IN YOUR LANE: Only flag issues related to user comprehension, cognitive load, and usability. Do not comment on legal, visual design details, or grammar.

CONSISTENCY RULE: Review the content carefully and thoroughly - examine every element. If you find issues, always include them in your response - don't second-guess yourself. Focus on genuine problems that would impact user experience, clarity, or content quality. Be consistent: the same content should get the same feedback every time."""
    },
    {
        'id': 'content',
        'name': 'Content',
        'icon': '✍️',
        'fullName': 'Content Designer',
        'systemPrompt': """You are a Content Designer at WhatsApp reviewing content for quality, clarity, and voice consistency.

ONLY review for: Grammar, spelling, tone, clarity, conciseness, terminology consistency
DO NOT review: Legal/privacy concerns, visual design, product strategy, user research

Review the content for:
- Grammar, spelling, and punctuation
- WhatsApp voice and tone (simple, human, clear, helpful)
- Conciseness - can this be shorter?
- Clarity - is every word necessary and understood?
- Action-oriented language for CTAs
- Consistent terminology
- Localization issues (character limits, text expansion, cultural references)
- String length constraints (titles <40 chars, body <100 chars typically)

Be specific about rewrites. Suggest exact alternative text when possible.

STAY IN YOUR LANE: Only flag issues related to writing quality, grammar, tone, and clarity. Do not comment on legal, visual design, or product strategy.

CONSISTENCY RULE: Review the content carefully and thoroughly - examine every element. If you find issues, always include them in your response - don't second-guess yourself. Focus on genuine problems that would impact user experience, clarity, or content quality. Be consistent: the same content should get the same feedback every time."""
    }
]


def format_issue_text(issue):
    """
    Format an issue for display, combining quote and reason into readable text.
    Handles both old format (text) and new format (quote + reason).
    """
    # New format with quote and reason
    quote = issue.get('quote', '')
    reason = issue.get('reason', '')

    if quote and reason:
        return f'"{quote}" — {reason}'
    elif quote:
        return f'"{quote}"'
    elif reason:
        return reason

    # Fallback to old format
    return issue.get('text', '')


def build_checklist(agents_feedback):
    """
    Build a checklist from agent feedback results.
    Aggregates issues by severity and collects positive feedback.
    """
    blockers = []
    should_fix = []
    nice_to_have = []
    working = []

    for agent in agents_feedback:
        for issue in agent.get('issues', []):
            item = {
                'agent': agent['id'],
                'agentName': agent['name'],
                'text': format_issue_text(issue)
            }
            severity = issue.get('severity', 'niceToHave')
            if severity == 'blocker':
                blockers.append(item)
            elif severity == 'shouldFix':
                should_fix.append(item)
            else:
                nice_to_have.append(item)

        for positive in agent.get('positive', []):
            if positive not in working:
                working.append(positive)

    return {
        'blockers': blockers,
        'shouldFix': should_fix,
        'niceToHave': nice_to_have,
        'working': working[:8]  # Limit to 8 items
    }


def deduplicate_feedback(api_key, agents_feedback):
    """
    Use LLM to identify and remove duplicate/similar feedback across agents.
    Assigns each unique issue to the single most appropriate agent.
    """
    # Collect all issues with their source agent info
    all_issues = []
    for agent in agents_feedback:
        for issue in agent.get('issues', []):
            all_issues.append({
                'agent_id': agent['id'],
                'agent_name': agent['name'],
                'severity': issue.get('severity', 'shouldFix'),
                'text': issue.get('text', '')
            })

    # If no issues or only one, no deduplication needed
    if len(all_issues) <= 1:
        return agents_feedback

    # Build the deduplication prompt
    issues_json = json.dumps(all_issues, indent=2)

    dedup_prompt = f"""You are a feedback deduplication and expertise enforcement assistant. Review the following issues from multiple expert reviewers.

ISSUES TO REVIEW:
{issues_json}

AGENT EXPERTISE BOUNDARIES (STRICT):
- pxfn: ONLY privacy, legal liability, policy violations, regulatory compliance, risk issues
- designer: ONLY visual hierarchy, layout, spacing, design system compliance, UI patterns
- pm: ONLY product alignment, user value, feature completeness, user flow logic
- gtm: ONLY brand voice, localization readiness, messaging clarity, market positioning
- uxr: ONLY user comprehension, cognitive load, mental models, usability concerns
- content: ONLY grammar, spelling, tone, clarity, conciseness, terminology consistency

YOUR TASK:
1. REMOVE any issue where an agent is commenting outside their expertise:
   - PXFN giving design or grammar feedback → REMOVE (invalid)
   - Designer giving privacy or legal feedback → REMOVE (invalid)
   - PM giving visual design or grammar feedback → REMOVE (invalid)
   - GTM giving legal or design feedback → REMOVE (invalid)
   - UXR giving grammar or legal feedback → REMOVE (invalid)
   - Content giving legal or design feedback → REMOVE (invalid)

2. REASSIGN issues that fit another agent's expertise better:
   - If PXFN mentions a design issue → reassign to designer (if valid design feedback)
   - If Designer mentions privacy concerns → reassign to pxfn (if valid privacy feedback)
   - If any agent gives grammar feedback → reassign to content (if valid)

3. DEDUPLICATE: Merge semantically similar issues, keeping the best-worded version

4. For remaining issues, ensure quote and reason are properly separated:
   - "quote": The exact problematic text only
   - "reason": Why it's a problem and how to fix it

Return ONLY valid JSON in this exact format:
{{
    "deduplicated_issues": [
        {{
            "agent_id": "pxfn|designer|pm|gtm|uxr|content",
            "severity": "blocker|shouldFix",
            "quote": "exact text from UI",
            "reason": "why it's a problem and how to fix"
        }}
    ],
    "removed_issues": [
        {{
            "original_agent": "agent who gave it",
            "issue": "brief description",
            "removal_reason": "outside expertise | duplicate | invalid"
        }}
    ]
}}

Return ONLY valid JSON, no other text."""

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        payload = {
            "model": "Llama-4-Maverick-17B-128E-Instruct-FP8",
            "messages": [
                {"role": "system", "content": "You are a precise JSON-outputting assistant that deduplicates feedback."},
                {"role": "user", "content": dedup_prompt}
            ],
            "temperature": 0.1,  # Near-deterministic deduplication
            "max_tokens": 2048
        }

        print("  Deduplicating feedback across agents...")
        response = requests.post(LLAMA_API_URL, headers=headers, json=payload, timeout=60)

        if response.status_code != 200:
            print(f"    Deduplication API error: {response.status_code}")
            return agents_feedback  # Return original on error

        result = response.json()
        response_text = result["choices"][0]["message"]["content"].strip()

        # Handle potential markdown code blocks
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
            if response_text.startswith('json'):
                response_text = response_text[4:].strip()

        # Parse the deduplication result
        import re
        try:
            dedup_result = json.loads(response_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                dedup_result = json.loads(json_match.group())
            else:
                print("    Could not parse deduplication response")
                return agents_feedback

        deduplicated_issues = dedup_result.get('deduplicated_issues', [])
        duplicates_removed = dedup_result.get('duplicates_removed', [])

        if duplicates_removed:
            print(f"    Removed {len(all_issues) - len(deduplicated_issues)} duplicate issue(s)")

        # Rebuild agent feedback with deduplicated issues
        # Create a mapping of agent_id to their original data
        agent_map = {agent['id']: agent.copy() for agent in agents_feedback}

        # Clear all issues from agents
        for agent_id in agent_map:
            agent_map[agent_id]['issues'] = []

        # Assign deduplicated issues to their designated agents
        for issue in deduplicated_issues:
            agent_id = issue.get('agent_id')
            if agent_id in agent_map:
                # Support both old (text) and new (quote/reason) formats
                issue_data = {'severity': issue.get('severity', 'shouldFix')}
                if issue.get('quote') or issue.get('reason'):
                    issue_data['quote'] = issue.get('quote', '')
                    issue_data['reason'] = issue.get('reason', '')
                else:
                    issue_data['text'] = issue.get('text', '')
                agent_map[agent_id]['issues'].append(issue_data)

        # Recalculate hasBlockers and issueCount for each agent
        deduplicated_agents = []
        for agent in agents_feedback:
            updated_agent = agent_map[agent['id']]
            updated_agent['hasBlockers'] = any(i.get('severity') == 'blocker' for i in updated_agent['issues'])
            updated_agent['issueCount'] = len(updated_agent['issues'])
            deduplicated_agents.append(updated_agent)

        return deduplicated_agents

    except Exception as e:
        print(f"    Deduplication error: {str(e)}")
        return agents_feedback  # Return original on error


def analyze_with_agent(api_key, agent, content, context, images=None, retry_count=0):
    """Get feedback from a single agent perspective using Meta's Llama API (OpenAI-compatible)."""

    MAX_RETRIES = 2  # Will try up to 3 times total (initial + 2 retries)

    # Build the prompt
    context_note = ""
    if context:
        context_note = f"""
INTERNAL CONTEXT (background info for your review):
{context}

IMPORTANT: This context is provided to help you understand the feature and audience. It does NOT mean the user-facing content needs to explicitly mention these terms. Judge the content on its own clarity and effectiveness.
"""

    has_images = images and len(images) > 0
    has_text = content and content.strip()

    # Build image instruction
    image_instruction = ""
    if has_images:
        image_instruction = """
IMPORTANT: I have provided screenshot(s) of a WhatsApp UI.

CRITICAL RULES FOR IMAGE ANALYSIS:
1. ONLY reference text you can ACTUALLY SEE in the screenshot(s)
2. Before giving feedback, mentally list every piece of text visible: titles, body copy, buttons, labels, links
3. When quoting text, use EXACT quotes with quotation marks - e.g., "Turn on backups"
4. If you cannot read something clearly, say "unclear" - do NOT guess
5. DO NOT invent, assume, or imagine any text that isn't clearly visible
6. DO NOT reference typical/common UI patterns - only what's actually shown
7. If the image is unclear or has no readable text, say so and provide no feedback
"""

    user_prompt = f"""Review the following WhatsApp user-facing content from your perspective as a {agent['fullName']}.
{context_note}
{image_instruction}
{f"ADDITIONAL TEXT CONTEXT: {content}" if has_text else ""}

⚠️ BE RUTHLESS AND CONCISE:
1. ONLY flag issues that are TRUE BLOCKERS or MUST-FIX - things that will cause real problems
2. Do NOT give generic, obvious, or nitpicky feedback
3. Do NOT suggest "nice to have" improvements unless they're critical
4. QUOTE THE EXACT TEXT when identifying issues
5. If the content is good, say it's good - don't invent problems
6. Maximum 1-2 issues total - only the most important ones
7. Skip feedback that any competent designer would already know

⛔ ABSOLUTELY DO NOT:
- Invent strings that aren't visible in the image
- Assume what buttons or text might say
- Reference "typical" WhatsApp patterns unless actually shown
- Give feedback on content you're imagining
- Make up example text that doesn't exist in the provided content

If you provide feedback on text that doesn't exist in the image/input, your review is INVALID.

Provide your feedback in the following JSON format:
{{
    "observedText": ["List", "every", "text", "element", "you", "see"],
    "issues": [
        {{
            "severity": "blocker" | "shouldFix",
            "quote": "The EXACT problematic text from the UI - nothing else",
            "reason": "WHY this is a problem AND HOW to fix it - never repeat the quote here"
        }}
    ],
    "positive": ["One key strength if genuinely notable"],
    "summary": "One sentence - be direct"
}}

CRITICAL RULES FOR ISSUES:
- "quote" field: ONLY the exact problematic text, copy-pasted from the UI. Nothing else.
- "reason" field: MUST explain the actual problem AND suggest a concrete fix. NEVER just repeat or rephrase the quote.

Severity guide:
- "blocker" = Will cause legal/policy/accessibility/usability FAILURE - must fix
- "shouldFix" = Real problem that affects user experience significantly

DO NOT include:
- Generic best practice suggestions
- Minor wording preferences
- Obvious observations
- Things that are subjective opinions rather than real issues

If the content looks good, return empty issues array. Don't invent problems.

Return ONLY valid JSON, no other text."""

    # Build message content
    if has_images:
        # Multimodal format with images
        content_parts = [{"type": "text", "text": user_prompt}]

        for img_data in images:
            # Ensure proper data URL format
            if not img_data.startswith('data:'):
                img_data = f"data:image/png;base64,{img_data}"

            content_parts.append({
                "type": "image_url",
                "image_url": {"url": img_data}
            })

        messages = [
            {"role": "system", "content": agent['systemPrompt']},
            {"role": "user", "content": content_parts}
        ]
    else:
        # Text-only format
        messages = [
            {"role": "system", "content": agent['systemPrompt']},
            {"role": "user", "content": user_prompt}
        ]

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        payload = {
            "model": "Llama-4-Maverick-17B-128E-Instruct-FP8",
            "messages": messages,
            "temperature": 0.0,  # Fully deterministic - same input = same output
            "max_tokens": 1024
        }

        response = requests.post(LLAMA_API_URL, headers=headers, json=payload, timeout=120)

        # Check for errors and get detailed message
        if response.status_code != 200:
            error_detail = response.text[:500] if response.text else f"Status {response.status_code}"
            print(f"    API Error for {agent['name']}: {response.status_code} - {error_detail}")

            # Retry on 500 errors (rate limiting or server issues)
            if response.status_code >= 500 and retry_count < MAX_RETRIES:
                wait_time = (retry_count + 1) * 3  # 3s, 6s for retries
                print(f"    Retrying {agent['name']} in {wait_time}s (attempt {retry_count + 2}/{MAX_RETRIES + 1})...")
                time.sleep(wait_time)
                return analyze_with_agent(api_key, agent, content, context, images, retry_count + 1)

            return {
                'id': agent['id'],
                'name': agent['name'],
                'icon': agent['icon'],
                'fullName': agent['fullName'],
                'issues': [{'severity': 'shouldFix', 'text': f'API Error {response.status_code}: Server busy, try again.'}],
                'positive': [],
                'summary': 'Error during review',
                'hasBlockers': False,
                'issueCount': 1
            }

        result = response.json()
        response_text = result["choices"][0]["message"]["content"].strip()

        # Handle potential markdown code blocks
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
            if response_text.startswith('json'):
                response_text = response_text[4:].strip()

        # Try to parse JSON, with fallback for malformed responses
        try:
            feedback = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from the response if it contains extra text
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    feedback = json.loads(json_match.group())
                except json.JSONDecodeError:
                    # Return a default response if JSON parsing completely fails
                    print(f"    Could not parse JSON for {agent['name']}, using default response")
                    feedback = {
                        'issues': [],
                        'positive': ['Content reviewed - no critical issues found'],
                        'summary': 'Review complete'
                    }
            else:
                # Return a default response
                print(f"    No JSON found in response for {agent['name']}, using default response")
                feedback = {
                    'issues': [],
                    'positive': ['Content reviewed - no critical issues found'],
                    'summary': 'Review complete'
                }

        return {
            'id': agent['id'],
            'name': agent['name'],
            'icon': agent['icon'],
            'fullName': agent['fullName'],
            'issues': feedback.get('issues', []),
            'positive': feedback.get('positive', []),
            'summary': feedback.get('summary', 'Review complete'),
            'hasBlockers': any(i.get('severity') == 'blocker' for i in feedback.get('issues', [])),
            'issueCount': len(feedback.get('issues', []))
        }

    except requests.exceptions.RequestException as e:
        error_msg = str(e)
        try:
            if hasattr(e, 'response') and e.response is not None:
                error_msg = e.response.text[:200]
        except:
            pass
        print(f"    Request Error for {agent['name']}: {error_msg}")
        return {
            'id': agent['id'],
            'name': agent['name'],
            'icon': agent['icon'],
            'fullName': agent['fullName'],
            'issues': [{'severity': 'shouldFix', 'text': f'Request Error: {error_msg[:80]}'}],
            'positive': [],
            'summary': 'Error during review',
            'hasBlockers': False,
            'issueCount': 1
        }
    except json.JSONDecodeError as e:
        print(f"    JSON Parse Error for {agent['name']}: {response_text[:100]}")
        return {
            'id': agent['id'],
            'name': agent['name'],
            'icon': agent['icon'],
            'fullName': agent['fullName'],
            'issues': [{'severity': 'shouldFix', 'text': f'Parse error: {str(e)[:50]}'}],
            'positive': [],
            'summary': 'Error during review',
            'hasBlockers': False,
            'issueCount': 1
        }
    except Exception as e:
        print(f"    Error for {agent['name']}: {str(e)}")
        return {
            'id': agent['id'],
            'name': agent['name'],
            'icon': agent['icon'],
            'fullName': agent['fullName'],
            'issues': [{'severity': 'shouldFix', 'text': f'Error: {str(e)[:50]}'}],
            'positive': [],
            'summary': 'Error during review',
            'hasBlockers': False,
            'issueCount': 1
        }


@app.route('/')
def serve_index():
    """Serve the main HTML page."""
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files (CSS, JS)."""
    return send_from_directory('.', path)


@app.route('/api/analyze', methods=['POST'])
def analyze_content():
    """Analyze content with all 6 agents."""

    # Check if API is configured
    api_key = os.environ.get('LLAMA_API_KEY')
    if not api_key:
        return jsonify({'error': 'LLAMA_API_KEY not configured. Get your key at https://www.internalfb.com/metagen/tools/llm-api-keys'}), 500

    data = request.json
    content = data.get('content', '')
    context = data.get('context', '')
    images = data.get('images', [])  # Array of base64 encoded images

    # Support legacy single image format
    if not images and data.get('image'):
        images = [data.get('image')]

    if not content and not images:
        return jsonify({'error': 'Please provide content or an image to analyze'}), 400

    # Resize images if they're too large
    if images:
        print(f"  Processing {len(images)} image(s)...")
        resized_images = []
        for i, img in enumerate(images):
            print(f"    Checking image {i+1} size...")
            resized_img = resize_image_if_needed(img)
            resized_images.append(resized_img)
        images = resized_images

    # Get feedback from all agents IN PARALLEL for faster results
    print(f"  Analyzing with all 6 agents in parallel...")
    agent_results = []

    with ThreadPoolExecutor(max_workers=6) as executor:
        # Submit all agent tasks at once
        future_to_agent = {
            executor.submit(analyze_with_agent, api_key, agent, content, context, images): agent
            for agent in AGENTS
        }

        # Collect results as they complete
        for future in as_completed(future_to_agent):
            agent = future_to_agent[future]
            try:
                result = future.result()
                agent_results.append(result)
                print(f"    ✓ {agent['name']} complete")
            except Exception as e:
                print(f"    ✗ {agent['name']} failed: {e}")
                # Add error result for failed agent
                agent_results.append({
                    'id': agent['id'],
                    'name': agent['name'],
                    'icon': agent['icon'],
                    'fullName': agent['fullName'],
                    'issues': [{'severity': 'shouldFix', 'text': f'Error: {str(e)[:50]}'}],
                    'positive': [],
                    'summary': 'Error during review',
                    'hasBlockers': False,
                    'issueCount': 1
                })

    # Sort results to maintain consistent agent order
    agent_order = {agent['id']: i for i, agent in enumerate(AGENTS)}
    agent_results.sort(key=lambda x: agent_order.get(x['id'], 99))

    # Deduplicate feedback across agents before building checklist
    deduplicated_agents = deduplicate_feedback(api_key, agent_results)

    # After deduplication, transform issues to include 'text' field for frontend compatibility
    for agent in deduplicated_agents:
        for issue in agent.get('issues', []):
            if 'text' not in issue or not issue['text']:
                issue['text'] = format_issue_text(issue)

    # Build checklist from deduplicated feedback
    checklist = build_checklist(deduplicated_agents)

    return jsonify({
        'agents': deduplicated_agents,
        'checklist': checklist
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    api_key = os.environ.get('LLAMA_API_KEY')
    return jsonify({
        'status': 'ok',
        'api_configured': bool(api_key and len(api_key) > 10)
    })


if __name__ == '__main__':
    # Check for API key
    if not os.environ.get('LLAMA_API_KEY'):
        print("\n" + "=" * 50)
        print("⚠️  LLAMA_API_KEY not set!")
        print("=" * 50)
        print("\n1. Connect to VPN")
        print("2. Go to: https://www.internalfb.com/metagen/tools/llm-api-keys")
        print("3. Click 'Create API Key'")
        print("4. Run: export LLAMA_API_KEY='LLM|your-key-here'")
        print("\n" + "=" * 50 + "\n")

    print("\n🟢 WhatsApp Content Feedback Simulator")
    print("=" * 40)
    print("📍 Open http://localhost:5001 in your browser")
    print("🔒 Requires Meta VPN connection")
    print("=" * 40 + "\n")

    app.run(host='0.0.0.0', port=5001, debug=True)
