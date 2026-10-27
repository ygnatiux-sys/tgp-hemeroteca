// ==============================================================================
// TGP SINAXIS GRAPH — INGESTA SESIÓN 01 (FUENTES 01 A 03 + ARQUITECTURA WEB ZENITAL)
// Motor: Neo4j (Cypher) / Compatible con APOC y Graph Data Science
// Autor: Xavier Benítez — The Great Puzzle Project
// ==============================================================================

// 1. CONSTRAINTS & ÍNDICES DE UNICIDAD
CREATE CONSTRAINT IF NOT EXISTS FOR (c:ConceptoTGP) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (o:Obra) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (m:Movimiento) REQUIRE m.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (cap:Capitulo) REQUIRE cap.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (art:ArtefactoMaterial) REQUIRE art.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (tool:HerramientaTGP) REQUIRE tool.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (t:TensionDialectica) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (w:NodoWeb) REQUIRE w.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (cs:CampoSemantico) REQUIRE cs.id IS UNIQUE;

// 2. CONCEPTOS MATRICES (EPISTEMOLOGÍA & NEUROGNOSIS)
MERGE (c1:ConceptoTGP {id: 'CONC_CONDICION_HUMANA'})
  SET c1.nombre = 'Condición Humana y Miedo Ontológico',
      c1.definicion = 'El impulso biológico del animal humano de fabricar refugios de sentido ante la finitud, el azar y la muerte.',
      c1.eje = 'Neurognosis / Somática',
      c1.axioma = 'El primer archivo fue un acto de fe: creer que el recuerdo podía sobrevivir al cuerpo.';

MERGE (c2:ConceptoTGP {id: 'CONC_PALIMPSESTO'})
  SET c2.nombre = 'Palimpsesto Cultural',
      c2.definicion = 'La materia y el símbolo como estratigrafía viviente: lo arcaico nunca muere, se reescribe, disfraza y reaparece.',
      c2.eje = 'Arqueosemiótica',
      c2.axioma = 'La cultura no es un monumento estático; es una sobreescritura perpetua.';

MERGE (c3:ConceptoTGP {id: 'CONC_ARCHIVO_VIVO'})
  SET c3.nombre = 'Archivo Vivo',
      c3.definicion = 'Ecosistema dinámico que integra la memoria afectiva con la evidencia documental frente al archivo burocrático petrificado.',
      c3.eje = 'Ecología del Sentido',
      c3.axioma = 'No recordamos para conservar el pasado, sino para seguir vivos en el presente.';

MERGE (c4:ConceptoTGP {id: 'CONC_CARTOGRAFIA_CRITICA'})
  SET c4.nombre = 'Cartografía Crítica',
      c4.definicion = 'Tercera Vía TGP: audacia comparativa sin pastiche esotérico ni esterilidad académica; no confunde analogía con causalidad.',
      c4.eje = 'Método TGP',
      c4.axioma = 'Duda. Investiga. Conecta.';

// 3. TENSIONES DIALÉCTICAS (EL BISTURÍ POLAR)
MERGE (t1:TensionDialectica {id: 'TENS_SOLAR_LUNAR'})
  SET t1.nombre = 'Archivo Solar vs. Memoria Hidráulica',
      t1.poloA = 'Archivo Solar (Uruk, Piedra, Ley, Estado, Fijeza, Sequedad, Poder)',
      t1.poloB = 'Memoria Hidráulica (Agua, Afecto, Flujo, Disolución, Olvido, Inconsciente)',
      t1.resolucion = 'Ecología del Sentido (Tool_51)';

MERGE (t2:TensionDialectica {id: 'TENS_SEGURIDAD_VITALIDAD'})
  SET t2.nombre = 'Seguridad Ontológica vs. Vitalidad Somática',
      t2.poloA = 'El archivo busca seguridad acumulando datos muertos.',
      t2.poloB = 'La memoria viva necesita olvidar para regenerar la experiencia.',
      t2.resolucion = 'Axioma: Cuanto más orden logramos, más olvidamos lo que queríamos proteger.';

// 4. OBRA CANÓNICA: SERIE E — HISTORIA DEL ARCHIVO
MERGE (obra:Obra {id: 'OBRA_HISTORIA_DEL_ARCHIVO'})
  SET obra.titulo = 'Historia del Archivo',
      obra.subtitulo = 'Del barro a la nube: génesis, poder y metamorfosis del sentido',
      obra.serie = 'Serie E – Los Arcontes del Sentido (Libro 1)',
      obra.autor = 'Xavier Benítez',
      obra.estetica = 'Museum Dark (#0A0D14, Cian #00EAFF, Oro #F2C779)',
      obra.dedicatoria = 'A quienes aún escuchan el murmullo de las aguas bajo el ruido de los archivos.';

// 5. MOVIMIENTOS NARRATIVOS (LOS 4 ACTOS DEL MAPA DE FLUJO)
MERGE (m1:Movimiento {id: 'MOV_01'})
  SET m1.numero = 1,
      m1.titulo = 'El Orden Nace del Miedo',
      m1.cadena = 'Memoria corporal -> Signo -> Registro -> Poder',
      m1.clima = 'Ocre-tierra, pulsos arcaicos, percusión lenta',
      m1.axioma = 'El primer archivo fue un acto de fe: creer que el recuerdo podía sobrevivir al cuerpo.';

MERGE (m2:Movimiento {id: 'MOV_02'})
  SET m2.numero = 2,
      m2.titulo = 'El Archivo se Vuelve Poder',
      m2.cadena = 'Texto -> Dogma -> Ciencia -> Algoritmo',
      m2.clima = 'Gris-papel a azul-luz, coral a zumbido digital, tensión media',
      m2.axioma = 'Cuanto más orden logramos, más olvidamos lo que queríamos proteger.';

MERGE (m3:Movimiento {id: 'MOV_03'})
  SET m3.numero = 3,
      m3.titulo = 'Lo Que el Archivo No Puede Guardar',
      m3.cadena = 'Olvido -> Memoria afectiva -> Disidencia -> Contra-archivo',
      m3.clima = 'Sepia-oscuro, silencio, respiración somática, ritmo lento-dramático',
      m3.axioma = 'Lo que no se archiva, nos archiva desde dentro.';

MERGE (m4:Movimiento {id: 'MOV_04'})
  SET m4.numero = 4,
      m4.titulo = 'El Retorno de la Memoria Viva',
      m4.cadena = 'Red -> Conciencia -> Ecología del sentido',
      m4.clima = 'Azul-cian-blanco, tono ambiental continuo, ritmo sereno-ascendente',
      m4.axioma = 'No recordamos para conservar el pasado, sino para seguir vivos en el presente.';

MERGE (obra)-[:ESTRUCTURADA_EN]->(m1);
MERGE (obra)-[:ESTRUCTURADA_EN]->(m2);
MERGE (obra)-[:ESTRUCTURADA_EN]->(m3);
MERGE (obra)-[:ESTRUCTURADA_EN]->(m4);

// 6. LOS 12 CAPÍTULOS (MÉTODO DEL EMBUDO TGP)
MERGE (cap01:Capitulo {id: 'CAP_01'})
  SET cap01.numero = 1, cap01.titulo = 'El impulso de guardar', cap01.parte = 'I. Historia Oficial';
MERGE (cap02:Capitulo {id: 'CAP_02'})
  SET cap02.numero = 2, cap02.titulo = 'Del templo al palacio', cap02.parte = 'I. Historia Oficial';
MERGE (cap03:Capitulo {id: 'CAP_03'})
  SET cap03.numero = 3, cap03.titulo = 'La invención del canon', cap03.parte = 'I. Historia Oficial';
MERGE (cap04:Capitulo {id: 'CAP_04'})
  SET cap04.numero = 4, cap04.titulo = 'La verdad como texto', cap04.parte = 'I. Historia Oficial';
MERGE (cap05:Capitulo {id: 'CAP_05'})
  SET cap05.numero = 5, cap05.titulo = 'La edad del papel y la razón', cap05.parte = 'I. Historia Oficial';
MERGE (cap06:Capitulo {id: 'CAP_06'})
  SET cap06.numero = 6, cap06.titulo = 'Del expediente al algoritmo', cap06.parte = 'I. Historia Oficial';

MERGE (cap07:Capitulo {id: 'CAP_07'})
  SET cap07.numero = 7, cap07.titulo = 'El olvido como fuerza', cap07.parte = 'II. La Pieza Intrusa';
MERGE (cap08:Capitulo {id: 'CAP_08'})
  SET cap08.numero = 8, cap08.titulo = 'La resistencia de la memoria viva', cap08.parte = 'II. La Pieza Intrusa';
MERGE (cap09:Capitulo {id: 'CAP_09'})
  SET cap09.numero = 9, cap09.titulo = 'El costo del orden', cap09.parte = 'II. La Pieza Intrusa';

MERGE (cap10:Capitulo {id: 'CAP_10'})
  SET cap10.numero = 10, cap10.titulo = 'Del archivo al ecosistema', cap10.parte = 'III. La Pieza del Puzzle';
MERGE (cap11:Capitulo {id: 'CAP_11'})
  SET cap11.numero = 11, cap11.titulo = 'Tecnología y sentido', cap11.parte = 'III. La Pieza del Puzzle';
MERGE (cap12:Capitulo {id: 'CAP_12'})
  SET cap12.numero = 12, cap12.titulo = 'Hacia una ecología del sentido', cap12.parte = 'III. La Pieza del Puzzle';

// Conexión Movimientos -> Capítulos (Relación 3x4)
MERGE (m1)-[:AGRUPA]->(cap01); MERGE (m1)-[:AGRUPA]->(cap02); MERGE (m1)-[:AGRUPA]->(cap03);
MERGE (m2)-[:AGRUPA]->(cap04); MERGE (m2)-[:AGRUPA]->(cap05); MERGE (m2)-[:AGRUPA]->(cap06);
MERGE (m3)-[:AGRUPA]->(cap07); MERGE (m3)-[:AGRUPA]->(cap08); MERGE (m3)-[:AGRUPA]->(cap09);
MERGE (m4)-[:AGRUPA]->(cap10); MERGE (m4)-[:AGRUPA]->(cap11); MERGE (m4)-[:AGRUPA]->(cap12);

// 7. ARTEFACTOS MATERIALES (ANCLAJES ARQUEOSEMIÓTICOS)
MERGE (art01:ArtefactoMaterial {id: 'ART_ISHANGO'})
  SET art01.nombre = 'Huesos de Ishango y Lebombo', art01.datacion = 'Paleolítico Superior (~20.000 - 40.000 AP)', art01.tipo = 'Prótesis mnemónica somática y lunar';
MERGE (art02:ArtefactoMaterial {id: 'ART_URUK'})
  SET art02.nombre = 'Tablillas de arcilla cuneiformes (Uruk)', art02.datacion = '~3200 a.C.', art02.tipo = 'Contabilidad teocrática y consolidación del Estado';
MERGE (art03:ArtefactoMaterial {id: 'ART_ALEJANDRIA'})
  SET art03.nombre = 'Biblioteca de Alejandría / Tabularium Romano', art03.datacion = 'Antigüedad Clásica', art03.tipo = 'Canon estatal de la ley y clasificación del saber';
MERGE (art04:ArtefactoMaterial {id: 'ART_GUTENBERG'})
  SET art04.nombre = 'Imprenta de tipos móviles y Enciclopedia', art04.datacion = 'Siglos XV-XVIII', art04.tipo = 'Reproducibilidad técnica y soberanía del dato racional';
MERGE (art05:ArtefactoMaterial {id: 'ART_BIG_DATA'})
  SET art05.nombre = 'Servidores de Silicio, Algoritmos e IA', art05.datacion = 'Siglos XX-XXI', art05.tipo = 'Archivo planetario ubicuo y automatizado';

MERGE (cap01)-[:ANCLADO_EN]->(art01);
MERGE (cap02)-[:ANCLADO_EN]->(art02);
MERGE (cap03)-[:ANCLADO_EN]->(art03);
MERGE (cap05)-[:ANCLADO_EN]->(art04);
MERGE (cap06)-[:ANCLADO_EN]->(art05);

// 8. HERRAMIENTAS METODOLÓGICAS TGP
MERGE (tool58:HerramientaTGP {id: 'TOOL_58'})
  SET tool58.codigo = 'Tool_58', tool58.nombre = 'Método del Embudo TGP', tool58.funcion = 'De la evidencia empírica factual al desvelo filosófico-somático';
MERGE (tool51:HerramientaTGP {id: 'TOOL_51'})
  SET tool51.codigo = 'Tool_51', tool51.nombre = 'Ecología del Sentido', tool51.funcion = 'Equilibrio dialéctico entre memoria viva (afectiva) y archivo documental';

MERGE (obra)-[:APLICA]->(tool58);
MERGE (cap12)-[:CULMINA_EN]->(tool51);

// 9. ARQUITECTURA WEB ZENITAL (HUB & SPOKE EN THEGREATPUZZLEPROJECT.COM)
MERGE (webHome:NodoWeb {id: 'WEB_HOME'})
  SET webHome.ruta = '/', webHome.nombre = 'Inicio / Home', webHome.rol = 'Impacto inmediato en 5s + Micro-Manifiesto Vivo (AdnBentoGsap)';
MERGE (webAbout:NodoWeb {id: 'WEB_ABOUT'})
  SET webAbout.ruta = '/about', webAbout.nombre = 'About / Manifiesto Integrado', webAbout.rol = 'Desarrollo en profundidad del ADN y Blindaje Epistémico';
MERGE (webArchivo:NodoWeb {id: 'WEB_ARCHIVO'})
  SET webArchivo.ruta = '/archivo', webArchivo.nombre = 'Archivo / Hemeroteca', webArchivo.rol = 'Archivo Vivo · Memoria en Movimiento (Ensayos y Dossiers)';
MERGE (webColeccion:NodoWeb {id: 'WEB_COLECCION'})
  SET webColeccion.ruta = '/coleccion', webColeccion.nombre = 'Colecciones', webColeccion.rol = 'Cartografía de la Experiencia Humana (10 Dominios Semánticos CS01-CS10)';

MERGE (webHome)-[:DERIVA_AUTORIDAD]->(webAbout);
MERGE (webHome)-[:EXPLORA_EN]->(webArchivo);
MERGE (webHome)-[:CLASIFICA_EN]->(webColeccion);
MERGE (webAbout)-[:FUNDAMENTA_A]->(obra);

// 10. CAMPOS SEMÁNTICOS (CS01 - CS10: LOS 10 DOMINIOS DE SENTIDO)
MERGE (cs01:CampoSemantico {id: 'CS01'}) SET cs01.codigo = 'CS01', cs01.nombre = 'Cosmos y Naturaleza', cs01.glosa = 'Cómo interpretamos el orden natural y miramos el cielo.';
MERGE (cs02:CampoSemantico {id: 'CS02'}) SET cs02.codigo = 'CS02', cs02.nombre = 'Vida, Cuerpo y Mente', cs02.glosa = 'Las capacidades físicas, cognitivas y emocionales de nuestra especie.';
MERGE (cs03:CampoSemantico {id: 'CS03'}) SET cs03.codigo = 'CS03', cs03.nombre = 'Signo, Lenguaje e Imagen', cs03.glosa = 'Cómo producimos y transmitimos sentido mediante símbolos.';
MERGE (cs04:CampoSemantico {id: 'CS04'}) SET cs04.codigo = 'CS04', cs04.nombre = 'Mito, Religión y Sagrado', cs04.glosa = 'Cómo construimos mundos sagrados frente al misterio.';
MERGE (cs05:CampoSemantico {id: 'CS05'}) SET cs05.codigo = 'CS05', cs05.nombre = 'Sociedad, Poder e Identidad', cs05.glosa = 'Cómo organizamos la pertenencia, las leyes y el poder.';
MERGE (cs06:CampoSemantico {id: 'CS06'}) SET cs06.codigo = 'CS06', cs06.nombre = 'Espacio, Materialidad y Arqueología', cs06.glosa = 'Las piedras, ciudades y objetos que corporizan la memoria.';
MERGE (cs07:CampoSemantico {id: 'CS07'}) SET cs07.codigo = 'CS07', cs07.nombre = 'Tiempo, Memoria e Historia', cs07.glosa = 'Cómo recordamos, archivamos y reescribimos el pasado.';
MERGE (cs08:CampoSemantico {id: 'CS08'}) SET cs08.codigo = 'CS08', cs08.nombre = 'Conocimiento, Filosofía, Ciencia y Tecnología', cs08.glosa = 'Cómo elaboramos modelos y herramientas para explicar el mundo.';
MERGE (cs09:CampoSemantico {id: 'CS09'}) SET cs09.codigo = 'CS09', cs09.nombre = 'Relato, Imaginación y Juego', cs09.glosa = 'Los mundos posibles y las narraciones que nos contamos.';
MERGE (cs10:CampoSemantico {id: 'CS10'}) SET cs10.codigo = 'CS10', cs10.nombre = 'Muerte, Ancestros y Más Allá', cs10.glosa = 'Cómo enfrentamos la finitud y la continuidad de la vida.';

MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs01);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs02);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs03);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs04);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs05);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs06);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs07);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs08);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs09);
MERGE (webColeccion)-[:ESTRUCTURADA_EN]->(cs10);

RETURN 'SINAXIS TGP - LOTE 1 Y ARQUITECTURA WEB INGESTADOS EXITOSAMENTE' AS Status;
