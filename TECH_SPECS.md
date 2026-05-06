# TECH_SPECS.md: THE "CLEAN DESK" MANIFESTO

### 1. NO "ELSE" STATEMENTS
Use Guard Clauses and Early Returns. Keep the logic path linear. If a condition isn't met, exit.

### 2. STRICTLY AVOID LOOPS
Use declarative Array methods (`.map`, `.filter`, `.reduce`). Use Functional Programming patterns to transform data.

### 3. MEMOIZATION AS A RULE
Do not re-run heavy math unnecessarily. Use `useMemo` for any coordinate transformations or physics logic. Treat these as "Variables with Brains" so we stay efficient.

### 4. DATA PIPING
Break complex transformations into a sequence of small, single-purpose functions. I want to see the "story" of the data as it moves from raw input to the final visual output.

### 5. LOGICAL FLATNESS
Separate "Thinking" (Math/Logic) from "Doing" (UI/Assets). Keep the patterns clean and the desk organized. Use `const`; never mutate data.

### 6. SRP & DRY (Single Responsibility & Don't Repeat Yourself)
Every module must "make sense to itself." Define assets (like filters) once and reference them everywhere.

### 7. PRINCIPLE OF LEAST SURPRISE (POLS)
Logic must be predictable and intuitive. If a function is named `calculateScreenPos`, it should only calculate; it should never trigger side effects like audio or state updates. Convention beats cleverness—stick to established patterns so the code base remains readable for anyone stepping into the woods.
