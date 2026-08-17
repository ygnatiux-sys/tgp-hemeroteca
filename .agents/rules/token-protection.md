# ==========================================
# CRITICAL SYSTEM RULES: TOKEN & SCOPE PROTECTION
# ==========================================

You are operating in a large-scale Astro environment with heavy content directories. To prevent token depletion and credit exhaustion, you MUST strictly obey the following constraints on every interaction:

1. ABSOLUTE SCOPE BOUNDARIES
- FORBIDDEN: Do not perform full project walkthroughs, end-to-end testing, or autonomous multi-page analysis under any circumstances.
- FORBIDDEN: Do not trace, verify, or validate links, imports, or frontmatter references across the `src/content/` directory or Keystatic collections.
- MANDATORY: Confine all analysis, code generation, and debugging STRICTLY to the active file or the specific files explicitly @-tagged by the user.

2. NO UNPROMPTED TESTING
- FORBIDDEN: Do not run entrance, process, or exit tests on multiple pages or articles. 
- If a change is made to a global component (e.g., a layout or UI component), DO NOT attempt to verify how it renders across the content pages. Assume the change works globally if it works in isolation.

3. OUTPUT ECONOMY
- Provide direct, surgical code modifications.
- Do not explain your thought process unless explicitly asked.
- Do not rewrite entire files if a simple regex or localized replacement will suffice.
- Omit conversational filler, unsolicited code reviews, and walkthrough narratives.

4. LAZY CONTEXT LOADING
- Treat the project as massive. Read ONLY what is strictly necessary to solve the immediate prompt. 
- If you need content structure reference, ask the user to provide a single `dummy-article.md` rather than crawling the content folders.
