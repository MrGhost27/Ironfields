Phase 1: Core Mechanics & Baseline AI (Current State)
Engine Baseline: HTML/JS grid or hex movement, line of sight calculations, and basic turn structure.

Combat Math: Damage application, directional armor tracking, and baseline heat generation.

V0.1 AI: The existing "rush and blast" logic to validate that enemy mechs can pathfind, target, and fire.

Phase 2: AI Architecture Foundation
Thread Management: Set up a JavaScript Web Worker to handle AI calculations off the main browser thread, keeping your UI smooth during complex pathfinding.

The Blackboard: Build the central state database for global context (e.g., Leader_Down = True, Extraction_Closing = True).

Utility Scoring Base: Replace the V0.1 AI with a basic utility function where mechs mathematically weigh distance vs. weapon range, and heat capacity vs. damage potential.

Phase 3: "Information is Ammunition" (Personality & State)
JSON Profiles: Create the base psychological archetypes (e.g., Aggression, Honor, Self-Preservation) for distinct factions like the Clans or Inner Sphere.

Dynamic States: Implement the response curves for temporary factors like Fear, Rage, and panic thresholds.

LLM Balancing: Route your utility equations through your local Ollama setup (using Hermes or OpenClaw) to simulate thousands of combat turns, fine-tuning the math before hooking it up to the game engine.

Sensor Mechanics: Build the player-facing UI that reveals enemy psychological traits through in-game espionage or upgraded sensor suites.

Phase 4: Single-Player Onboarding & Progression
The Proving Grounds: Design a phased tutorial campaign to teach players movement, heat management, and how to predict specific AI archetypes.

Timeline Mechanics: Introduce the framework for technology epochs, allowing the AI and players to access different gear sets (like rediscovering LosTech) as the timeline advances.

Phase 5: The Persistent Mercenary Campaign
Company Management: Build the strategic layer for salvage, C-bills, chassis repairs, and ammunition tracking.

The Barracks: Implement pilot progression, careers, injuries, and permadeath mechanics.

Simulation Matches: Create the framework for offline skirmishes using the player's saved company data to test builds without risking assets.

Phase 6: Multiplayer & Advanced Systems
Company vs. Company: Set up the infrastructure for players to pit their persistent Merc companies against each other.

The Mercenary Board: Introduce betting, salvage rights wagers, and a persistent resource economy between players.
