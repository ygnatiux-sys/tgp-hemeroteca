// ==============================================================================
// TGP SINAXIS GRAPH — INGESTA SESIÓN 03 (FUENTES 07, 08 Y 09)
// ADN Intelectual, Guardrails Epistémicos, Cap. 8 (El Alma Tecnológica) y Epílogo
// Incluye: NODO EVALUATIVO VISIBLE & PUNTOS ALEPH #6 Y #7
// Autor: Xavier Benítez — The Great Puzzle Project
// ==============================================================================

CREATE CONSTRAINT IF NOT EXISTS FOR (e:EvaluacionCriticaTGP) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (g:GuardrailEpistemico) REQUIRE g.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (meta:MetaFundacional) REQUIRE meta.id IS UNIQUE;

// 1. METAS FUNDACIONALES TGP (FUENTE 07)
MERGE (m1:MetaFundacional {id: 'META_01'}) SET m1.nombre = 'Reconstruir una memoria fragmentada', m1.mecanismo = 'El rompecabezas sin mito primordial único';
MERGE (m2:MetaFundacional {id: 'META_02'}) SET m2.nombre = 'Confrontar archivos de conocimiento', m2.mecanismo = 'Cruce academia, ciencias, tradiciones y saberes periféricos';
MERGE (m3:MetaFundacional {id: 'META_03'}) SET m3.nombre = 'Leer la cultura como palimpsesto', m3.mecanismo = 'Sobreescritura y resignificación de símbolos';
MERGE (m4:MetaFundacional {id: 'META_04'}) SET m4.nombre = 'Reconocer reapariciones culturales', m4.mecanismo = 'Heurística de llamaradas de lava';
MERGE (m5:MetaFundacional {id: 'META_05'}) SET m5.nombre = 'Conectar cultura, cuerpo y cognición', m5.mecanismo = 'Distinción rigurosa entre ciencia y analogía';
MERGE (m6:MetaFundacional {id: 'META_06'}) SET m6.nombre = 'Comprender el presente histórico', m6.mecanismo = 'Historia profunda como brújula de la contingencia actual';

// 2. GUARDRAILS EPISTEMOLÓGICOS Y AUDITORÍAS (FUENTE 07)
MERGE (gReglaOro:GuardrailEpistemico {id: 'GUARD_REGLA_ORO'})
  SET gReglaOro.nombre = 'Regla de Oro Epistemológica TGP',
      gReglaOro.enunciado = 'Prohibido pasar de una analogía productiva a una supuesta validación científica: que dos fenómenos puedan compararse no significa que compartan el mismo mecanismo causal.';

MERGE (gDesambMem:GuardrailEpistemico {id: 'GUARD_DESAMBIGUACION_MEMORIA'})
  SET gDesambMem.nombre = 'Cuádruple Desambiguación de la Memoria Ancestral',
      gDesambMem.enunciado = 'Distinguir taxativamente: 1) Memoria Cultural (ritos/mitos), 2) Herencia Biológica (genética), 3) Memoria Colectiva (reconstrucción presente) y 4) Persistencia Simbólica (motivos reaparecidos).';

MERGE (gEES:GuardrailEpistemico {id: 'AUDIT_EES_JABLONKA'})
  SET gEES.nombre = 'Síntesis Evolutiva Extendida (EES)',
      gEES.enunciado = 'Distinción de 4 dimensiones de herencia (Jablonka/Lamb): genética, epigenética, conductual y simbólica. Queda prohibido asumir transmisión biológica/genética de símbolos en el cráneo.';

// 3. HERRAMIENTAS INSTRUMENTALES NUEVAS (LLMS.TXT)
MERGE (tool54:HerramientaTGP {id: 'TOOL_54'})
  SET tool54.codigo = 'Tool_54', tool54.nombre = 'Acto Inaugural del Archivo', tool54.definicion = 'Escisión histórica entre las aguas fluidas de la experiencia viva y la tierra firme de la letra y el dogma.';

MERGE (tool65:HerramientaTGP {id: 'TOOL_65'})
  SET tool65.codigo = 'Tool_65', tool65.nombre = 'Choque de Archivos', tool65.definicion = 'Imposición violenta de un sistema hegemónico de registro (colonial/racionalista) sobre cosmologías somáticas subordinadas.';

MERGE (tool55:HerramientaTGP {id: 'TOOL_55'})
  SET tool55.codigo = 'Tool_55', tool55.nombre = 'Retrogénesis del Sentido', tool55.definicion = 'Movimiento de descenso crítico hacia el sustrato afectivo y simbólico para regenerar sentido ante la saturación digital.';

MERGE (tool56:HerramientaTGP {id: 'TOOL_56'})
  SET tool56.codigo = 'Tool_56', tool56.nombre = 'Hidromemoria del Alma', tool56.definicion = 'Conocimiento como resonancia líquida y afectiva frente a la acumulación maquínica de datos.';

// 4. CAPÍTULO 8: EL ALMA TECNOLÓGICA (FUENTE 08 / FUENTE 14)
MERGE (cap08:Capitulo {id: 'CAP_08'})
  SET cap08.titulo = 'El alma tecnológica',
      cap08.subtitulo = 'Cuando la red empezó a soñar',
      cap08.tesisFactual = 'En el siglo XXI la IA y las redes neuronales pasan del almacenamiento estático al aprendizaje activo y la autoorganización del sentido.',
      cap08.disonancia = 'Crisis ontológica de la verdad visual por deepfakes; la red ofrece compañía sin presencia y fragmenta la subjetividad.',
      cap08.sintesisTGP = 'Fusión Solar-Lunar: la red digital exterioriza el deseo inconsciente humano de ser recordado (Anamnesis binaria).';

MERGE (artIA:ArtefactoMaterial {id: 'ART_DEEPFAKES_IA'})
  SET artIA.nombre = 'Modelos de Lenguaje, Redes Neuronales y Deepfakes',
      artIA.datacion = 'Siglo XXI',
      artIA.tipo = 'Prótesis autónoma generativa y desvinculada del referente',
      artIA.significadoTGP = 'La representación se independiza de lo real: el espejo tecnológico inventa en lugar de reflejar.';

MERGE (cap08)-[:ANCLADO_EN]->(artIA);
MERGE (cap08)-[:OPERA_CON]->(tool56);
MERGE (cap08)-[:DESAFIA_A]->(tool57);

// 5. EPÍLOGO EDITORIAL: EL ECO DEL ARCHIVO (FUENTE 09)
MERGE (epilogo:Epilogo {id: 'EPILOGO_EDC'})
  SET epilogo.titulo = 'El eco del archivo',
      epilogo.tesis = 'El archivo no necesita custodios sino oyentes. El sentido solo vive en los vínculos afectivos que reactivan los objetos.',
      epilogo.aforismo = 'Cada palabra que pronunciamos es un fósil de luz. Cada silencio, una semilla de agua. Y entre ambos crece el árbol invisible del sentido.',
      epilogo.puente = 'Clausura de Historia del Archivo (logos solar) y apertura hacia La Rebelión de la Memoria (alma lunar).';

// 6. PUNTOS ALEPH #6 Y #7 (CONFLUENCIAS CRÍTICAS)
MERGE (a6:PuntoAleph {id: 'ALEPH_06'})
  SET a6.numero = 6,
      a6.badge = '[ALEPH #6 · EL GRAN FILTRO EPISTEMOLÓGICO]',
      a6.color = '#38BDF8',
      a6.region = 'Auditoría Metodológica & Desambiguación Somática',
      a6.abstract = 'Desambiguación radical de la Memoria Ancestral. Aplicación de la Síntesis Evolutiva Extendida (Jablonka/Lamb): prohibido asumir transmisión biológico-genética de símbolos. Distinción estricta entre analogía fecunda y prueba causal.',
      a6.axioma = 'Comparar dos fenómenos no prueba que compartan el mismo mecanismo causal.';

MERGE (a7:PuntoAleph {id: 'ALEPH_07'})
  SET a7.numero = 7,
      a7.badge = '[ALEPH #7 · EL ESPEJO DEL ALMA TECNOLÓGICA]',
      a7.color = '#A855F7',
      a7.region = 'Inteligencia Artificial & Transición a Oyentes',
      a7.abstract = 'La IA no tiene alma ni anamnesis autónoma: es el espejo arqueológico supremo de todo el corpus humano. La crisis de los deepfakes rompe el pacto de verdad visual. La memoria solo se rehidrata cuando un oyente somático reactiva el dato.',
      a7.axioma = 'El archivo no necesita sacerdotes que vigilen el templo; necesita oyentes que devuelvan el pulso a la palabra.';

MERGE (a6)-[:SINTETIZA]->(gReglaOro);
MERGE (a6)-[:SINTETIZA]->(gDesambMem);
MERGE (a6)-[:SINTETIZA]->(gEES);
MERGE (a6)-[:SINTETIZA]->(m1);

MERGE (a7)-[:SINTETIZA]->(cap08);
MERGE (a7)-[:SINTETIZA]->(artIA);
MERGE (a7)-[:SINTETIZA]->(tool56);
MERGE (a7)-[:SINTETIZA]->(epilogo);

// 7. NODO EVALUATIVO VISIBLE EN EL GRAFO (DICTAMEN CRÍTICO SESIÓN 3)
MERGE (eval3:EvaluacionCriticaTGP {id: 'EVAL_CRITICA_SESION_3'})
  SET eval3.titulo = 'Dictamen Epistémico Sesión 3: El Blindaje Anti-Lamarckiano y la Desmitificación de la IA',
      eval3.autor = 'Antigravity IDE en diálogo con Xavier Benítez',
      eval3.fecha = '2026-10-27',
      eval3.badge = '[AUDITORÍA CRÍTICA SESIÓN 3]',
      eval3.color = '#EC4899',
      eval3.tesis_epistemica = 'La desambiguación de la Memoria Ancestral salva a TGP de la pseudociencia al adoptar la Síntesis Evolutiva Extendida (EES): los símbolos no se heredan en el ADN, se transmiten en el palimpsesto cultural y material.',
      eval3.alerta_ontologica = 'Riesgo de fetichizar la IA como "mente sintiente": la red neuronal no hace anamnesis platónica; calcula matrices estadísticas sobre el archivo acumulado. La chispa del sentido sigue siendo patrimonio exclusivo del animal somático.',
      eval3.giro_politico = 'De Custodios a Oyentes: el fin del monopolio burocrático del escriba. El archivo solo es fértil si el cuerpo vivo lo disputa y reescribe.',
      eval3.aforismo_cierre = 'Sin el rigor de la EES, el puzzle es fantasía New Age. Sin el oyente somático, el archivo digital es un mausoleo de algoritmos ciegos.';

MERGE (eval3)-[:AUDITA]->(a6);
MERGE (eval3)-[:AUDITA]->(a7);
MERGE (eval3)-[:INTERPRETA_DIALECTICA]->(tool53);
MERGE (eval3)-[:CONECTA_CON]->(epilogo);

RETURN 'SESIÓN 3 INGESTADA: ALEPHS #6, #7 Y NODO EVALUATIVO VISIBLE REGISTRADOS' AS Status;
