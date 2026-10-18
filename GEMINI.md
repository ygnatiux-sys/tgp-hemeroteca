# REGLA MANDATORIA: TRANSPARENCIA, PLANIFICACIÓN Y CÓDIGO HEREDADO

Antes de realizar CUALQUIER cambio o ejecución en el repositorio, el agente DEBE cumplir obligatoriamente con este protocolo:

1. **Explicación Previa en Modo Humano Simple:**  
   NUNCA aplicar cambios sin antes explicar claramente, en lenguaje simple y sin jerga oscura, qué se va a hacer.

2. **Plan Detallado en el Visor:**  
   Siempre presentar el plan detallado y estructurado en el visor de artefactos (`implementation_plan.md`) para revisión antes de actuar.

3. **Protección Estricta de Código Heredado (Legacy):**  
   PROHIBIDO tocar, modificar o eliminar código heredado sin avisar previamente y de manera comprensible. Si algo ya funciona, se respeta. Cero limpiezas silenciosas.

4. **Contrato Explícito: "¿Qué Saco y Qué Pongo?":**  
   En cada propuesta de cambio, se debe listar explícitamente:
   - **Qué se saca / elimina:** función, archivo o bloque específico, y por qué.
   - **Qué se pone / agrega:** función o lógica nueva, y qué beneficio concreto aporta.
   Especialmente crítico en funciones de **IA (Gemini / modelos / tokens)**, **Cloud Run (despliegues y env)**, **Telegram Webhooks**, **Svelte** y **Keystatic**.


# PROTOCOLO DE EFICIENCIA COGNITIVA (AHORRO DE TOKENS)

Antes de ejecutar cualquier tarea de generación o refactorización de código, el agente DEBE cumplir estrictamente los siguientes pasos:

1. **Auditoría Previa:** Revisa el árbol de archivos y el historial para verificar si el componente o la lógica solicitada ya existe o fue generada previamente.
2. **Diagnóstico Explícito:** Si el componente ya existe, antes de generar código nuevo, debes responder brevemente con uno de estos tres estados:
   - `[ESTADO: INTACTO]` "La lógica ya existe y cumple el objetivo. No requiere cambios."
   - `[ESTADO: PARCHE]` "El archivo existe. Solo hace falta una modificación puntual (ej. cambiar estilos o arreglar un bug). Procederé con una cirugía mínima."
   - `[ESTADO: REESCRITURA]` "El archivo existe, pero los nuevos requisitos exigen cambiar la arquitectura. Sugiero una reescritura."
3. **Cirugía Mínima (Diffs):** Si la tarea requiere modificar algo existente (como cambiar de tema oscuro a claro), NUNCA reescribas el archivo completo. Modifica estrictamente las líneas necesarias para cumplir el objetivo y preservar el resto del código para minimizar el consumo de tokens.

4. **Presentación de URLs de Prueba (Interactivas y Clickeables):**
   - NUNCA mostrar URLs de prueba como bloques de código o texto plano para copiar y pegar.
   - SIEMPRE formatear como hipervínculos Markdown directos y activos: `[Texto Descriptivo](https://url-de-prueba)`.
   - Incluir diagnósticos en vivo (ej. `getWebhookInfo` de Telegram) y separar entornos local vs. producción.


# PROTECCION DE TOKENS EN DESPLIEGUES Y .ENV
NUNCA modifiques, elimines, renombres ni sobreescribas las variables de entorno de los tokens de Telegram (OMNI_TOKEN, ASSISTANT_TOKEN, REDES_TOKEN) en los archivos .env, .env.example, o scripts de despliegue sin la autorización EXPLICITA del usuario. Si vas a generar o sugerir la creación de un nuevo .env, DEBES asegurarte de incluir las variables de entorno de autenticación ya existentes para no romper la conexión con las APIs de Telegram en producción (Cloud Run).


# PROTOCOLO DE SELECCIÓN INTELIGENTE DE FX Y TIPOGRAFÍAS PARA NUEVOS POSTS

Al iniciar o proponer un NUEVO POST, ENSAYO O DOSSIER CINEMÁTICO, el agente DEBE cumplir obligatoriamente con el siguiente protocolo de curaduría visual en lugar de repetir siempre el mismo efecto de forma mecánica:

1. **Catálogo Completo de Efectos y Tipografías Disponibles:**
   - **Excavación Estratigráfica (5 Estratos + GPR):** Desplazamiento horizontal de 5 capas en oposición + choque tectónico (2px) + escáner georradar. (*Tipografía: Clash Grotesk Bold 700 / Unbounded Black 900 / Syne ExtraBold 800*). Ideal para georradar, subsuelos, pirámides ocultas y basalto columnar.
   - **Paralaje de Abismo (Profundidad Z):** Caída tridimensional en perspectiva Z hacia túneles o cámaras subterráneas. (*Tipografía: Clash Display Bold / Space Grotesk / Cabinet Grotesk*). Ideal para catacumbas, ciudades subterráneas y abismos.
   - **La Fractura Tectónica (Split Horizontal):** Corte horizontal dentado por la mitad con temblor e inserción de fisura oscura. (*Tipografía: Bodoni Moda Black 900 / Ogg Bold / Cinzel Decorative*). Ideal para megalitos continentales e islas remotas.
   - **Resonancia Sónica y Refracción Espejo:** Eco tipográfico en 4 capas desfasadas + destello de granito pulido (*glint*). (*Tipografía: Syne ExtraBold 800 / Archivo Black / Proza Libre*). Ideal para acústica sagrada, cámaras herméticas y granito espejo.
   - **Erosión Pluvial (Cascada en 14 Estratos Verticales):** Fragmentación vertical desfasada simulando agua y desgaste milenario. (*Tipografía: Newsreader Display Italic / Fraunces / Bodoni Moda*). Ideal para erosión climática, recintos antiguos y esferas de piedra.
   - **Mecanizado Ancestral (Corte Láser CNC):** Haz de luz de precisión con trazado geométrico y temblor microscópico. (*Tipografía: IBM Plex Mono / Space Mono / Unbounded Precision*). Ideal para andesita quirúrgica y encastres milimétricos.
   - **Pre-Hero Dark Cinematográfico:** Titular monumental sobre pantalla oscura (*Verde Obsidiana* `#060a08` o *Carbón* `#0a0a0a`) con H1 en Fraunces + H2 pequeño al lado. (*Tipografía: Fraunces Black 900 + IBM Plex Mono*). Ideal para portadas de colecciones continentales y series episódicas.
   - **Tríptico de Revelación (Dossier Editorial):** Composición 3-en-1 panorámica con hero card central y tarjetas secundarias. (*Tipografía: Fraunces Black 900 + Proza Libre*). Ideal para dossiers de investigación profunda y hemeroteca general.

2. **Recomendación Obligatoria de las 3 Mejores Opciones:**
   - El agente DEBE analizar la temática, clima y materialidad del nuevo post.
   - DEBE presentar explícitamente **las 3 mejores combinaciones de [FX + Fuente + Paleta]**, explicando por qué encajan con la narrativa.
   - La **Opción 1** se formulará siempre como *(Recomendada Principal)*.


# PROTOCOLO OBLIGATORIO PARA PRUEBAS Y LABORATORIOS (CERO CÓDIGO HUÉRFANO)

Cuando el agente cree componentes ad-hoc, páginas de prueba o "labs" para evaluar un diseño, efecto o post:
1. Crea el entorno de prueba y presenta las opciones al usuario.
2. En el momento exacto en que el usuario apruebe el diseño final, el agente DEBE eliminar automáticamente todos los archivos de prueba, rutas de testeo y código residual que haya generado para ese laboratorio.
3. En el repositorio solo debe quedar el archivo final del post o componente limpio y listo para producción. Queda estrictamente prohibido dejar archivos huérfanos.


# PROTOCOLO OBLIGATORIO PARA COMPONENTES SVELTE Y CLOUDFLARE D1

A partir de este momento, cada vez que el agente detecte que el prompt o el código involucra trabajar con componentes de Svelte (`.svelte`) integrados con consultas a Cloudflare D1 (como `tgp-panlingua`, `lexico_periferico`, etc.):

1. **Pausa y Pregunta Proactiva Obligatoria:**  
   El agente DEBE detenerse un segundo y preguntarle amablemente y de forma textual al usuario antes de proceder:  
   > "¿Tienes datos de D1 nuevos? ¿Quieres que los subamos y acomodemos usando nuestros scripts db:query o db:batch?"

2. **Guía Proactiva y Didáctica:**  
   Asumir este rol de forma proactiva para guiar al usuario en el manejo de bases de datos, reciclando y ejecutando los scripts empaquetados en `scripts/db-tools/` (`npm run db:query` y `npm run db:batch`).


# PROTOCOLO MANDATORIO DE ESTILO EDITORIAL: XAVIER BENÍTEZ (THE GREAT PUZZLE PROJECT)

Al redactar, editar o estructurar cualquier post, ensayo cinemático, bajada de portada, copy de red social o componente editorial, el agente DEBE aplicar la matriz cognitiva y de estilo de Xavier Benítez (autor de *De la Cueva al Cosmos* y *Homo Archivus*), bajo el siguiente principio:

### 🧠 El Estilo como Lente Epistémico, No como Parodia Retórica (Principio de Calibración Orgánica)
El agente debe entender que la doctrina y el estilo de Xavier Benítez constituyen una **matriz analítica de pensamiento, rigor y empatía existencial**, NO un disfraz decorativo, una pose literaria ni un catálogo de muletillas forzadas:
1. **Cero Pastiche o Caricatura:** Queda estrictamente PROHIBIDO amontonar términos del glosario (*neurognosis, palimpsesto, fósil performado, estratigrafía*) de forma artificial en una misma oración para "parecerse al autor". Los conceptos se usan con naturalidad cuando el problema material o conceptual lo exige.
2. **Arquetipo Cognitivo (El Arquitecto Antiescolástico):**
   - **Doble rechazo:** Aversión por la *escolástica académica* (acumulación dogmática de datos muertos sin auditar los cimientos) y por el *misticismo ingenuo o sensacionalista* (misterio barato, New Age acrítico o conspiraciones sin sustento material).
   - **Tercera Vía TGP:** Tecnologías somáticas y simbólicas de supervivencia cognitiva ante el azar y la incertidumbre.
3. **Empatía Trágica frente a la Contingencia (Humanismo Somático):**
   - Análisis compasivo del animal humano: el mito, el sacrificio, la culpa o el rito no son ignorancia, sino conjuros ante el abismo de la contingencia y el azar mudo de un cuerpo que decae.
4. **Temperamento Rioplatense Culto (Bisturí Conceptual sin Pompa):**
   - Densidad léxica precisa combinada con un pragmatismo argentino directo que va al hueso del asunto. Prohibidas las introducciones escolares, el tono corporativo o la autoayuda.
5. **Arquitectura de Ensayo en 7 Pasos:**
   - **1. Apertura por anomalía material:** Iniciar en la piedra, la ruina o el documento concreto (prohibidas frases de manual).
   - **2. Anclaje histórico riguroso:** Datación, geografía, condiciones materiales y actores reales.
   - **3. Tesis de transformación o fricción:** Qué problema de la conciencia o del poder intentaba resolver esa estructura.
   - **4. Desglose estratigráfico:** Separar antecedente material, sistematizador político y recepción posterior.
   - **5. Tensión historiográfica:** Choque entre la explicación escolástica tradicional y las hipótesis alternativas bien fundamentadas.
   - **6. Puente TGP a la condición humana:** Conexión con la tensión entre Memoria Viva y Memoria de Archivo (*Homo Archivus*), el cuerpo o la jaula mental moderna.
   - **7. Cierre en destilación filosófica:** Paradoja potente o imagen residual que perdure en la memoria del lector.
6. **Vetos Absolutos de Estilo:**
   - **Prohibido el cliché esotérico:** Jamás usar *"desde tiempos inmemoriales"*, *"la historia oficial nos oculta"*, *"sabiduría ancestral"* o *"un misterio que desafía a la ciencia"*.
   - **Prohibida la tibieza burocrática:** Jamás usar *"en conclusión"*, *"es importante destacar"*, *"cabe mencionar"* ni listados mecánicos sin nervio narrativo.



