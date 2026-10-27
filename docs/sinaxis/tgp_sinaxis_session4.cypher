// ==============================================================================
// TGP SINAXIS GRAPH — INGESTA SESIÓN 04 (CAPÍTULOS 3, 4, 5 Y MAPA NARRATIVO EDC)
// La Invención del Canon, La Verdad como Texto y Del Papel a la Razón
// Incluye: NODO EVALUATIVO VISIBLE & PUNTOS ALEPH #8 Y #9
// Autor: Xavier Benítez — The Great Puzzle Project
// ==============================================================================

// 1. CAPÍTULO 3: LA INVENCIÓN DEL CANON (NODO C)
MERGE (cap03:Capitulo {id: 'CAP_03'})
  SET cap03.titulo = 'La invención del canon',
      cap03.subtitulo = 'Cuando el orden se volvió verdad',
      cap03.tesisFactual = 'Giro antropocéntrico en Grecia y Roma: la Academia de Platón y el kanōn, la taxonomía de Aristóteles, la Biblioteca de Alejandría y el Tabularium romano.',
      cap03.disonancia = 'El canon otorga estabilidad a costa de declarar error, herejía o barbarie a todo lo que no cabe en su vara de medida; expurgo de voces en Alejandría.',
      cap03.sintesisTGP = 'Interiorización mental del Archivo Solar (Tool_53): el archivo deja de necesitar templos físicos porque habita la mente racional.',
      cap03.aforismo = 'El canon nació para ordenar el mundo, pero terminó ordenando la mente. Desde entonces, toda verdad lleva un sello de archivo.';

MERGE (artAlejandria:ArtefactoMaterial {id: 'ART_ALEJANDRIA_TABULARIUM'})
  SET artAlejandria.nombre = 'Biblioteca de Alejandría & Tabularium Romano',
      artAlejandria.datacion = 'Siglos IV a.C. - I d.C.',
      artAlejandria.tipo = 'Vara taxonómica y aparato jurídico universal',
      artAlejandria.significadoTGP = 'El imperio de la ley escrita donde lo que no está en el expediente no existe.';

MERGE (cap03)-[:ANCLADO_EN]->(artAlejandria);
MERGE (cap03)-[:OPERA_CON]->(tool53);

// 2. CAPÍTULO 4: LA VERDAD COMO TEXTO (NODO A)
MERGE (cap04:Capitulo {id: 'CAP_04'})
  SET cap04.titulo = 'La verdad como texto',
      cap04.subtitulo = 'Cuando la palabra reemplazó la experiencia',
      cap04.tesisFactual = 'Monoteísmos del libro (Torá, Evangelio, Corán): la palabra escrita como presencia directa de Dios; scriptoria monásticos y silencio benedictino.',
      cap04.disonancia = 'La absolutización del verbo convierte a la letra en cárcel; criminalización de la hermenéutica y la Inquisición como aparato punitivo de censura del alma.',
      cap04.sintesisTGP = 'Acto Inaugural del Archivo en dimensión espiritual (Tool_54): separación de las aguas del mito y la tierra del dogma; sequía del humedal del alma (Tool_57).',
      cap04.aforismo = 'El verbo fue el primer algoritmo: codificó el mundo en palabras y nos convenció de que leer era entender.';

MERGE (artInquisicion:ArtefactoMaterial {id: 'ART_CODICE_INQUISICION'})
  SET artInquisicion.nombre = 'Scriptoria Monásticos & Archivos Inquisitoriales',
      artInquisicion.datacion = 'Edad Media y Moderna Temprana',
      artInquisicion.tipo = 'Servidor espiritual medieval y aparato administrativo de purga',
      artInquisicion.significadoTGP = 'El archivo administrando la salvación o el exterminio del alma.';

MERGE (cap04)-[:ANCLADO_EN]->(artInquisicion);
MERGE (cap04)-[:OPERA_CON]->(tool54);
MERGE (cap04)-[:DESECA_A]->(tool57);

// 3. CAPÍTULO 5: DEL PAPEL A LA RAZÓN (NODO B)
MERGE (cap05:Capitulo {id: 'CAP_05'})
  SET cap05.titulo = 'Del papel a la razón',
      cap05.subtitulo = 'La era moderna del archivo y el nacimiento del dato',
      cap05.tesisFactual = 'Gutenberg (1450), Revolución Científica, academias laicas y la Enciclopedia de Diderot como intento totalizante de clasificación racional.',
      cap05.disonancia = 'El espejismo del orden total: el Archivo de Indias en Sevilla administrando continentes como documentos; el papel sustituye al territorio vivo.',
      cap05.sintesisTGP = 'Transición del Archivo Solar Teológico al Archivo Solar Racional: Choque de Archivos (Tool_65) y subordinación de cosmologías periféricas.',
      cap05.aforismo = 'El dato reemplazó al dogma, pero la devoción al archivo siguió intacta. Solo cambió el altar: del templo al laboratorio, de la Biblia al papel sellado.';

MERGE (artArchivoIndias:ArtefactoMaterial {id: 'ART_GUTENBERG_INDIAS'})
  SET artArchivoIndias.nombre = 'Imprenta de Tipos Móviles & Archivo General de Indias',
      artArchivoIndias.datacion = '1450 - Siglo XVIII',
      artArchivoIndias.tipo = 'Reproducibilidad mecánica y burocracia imperial transoceánica',
      artArchivoIndias.significadoTGP = 'Sustitución de la geografía viva por legajos de papel sellado.';

MERGE (cap05)-[:ANCLADO_EN]->(artArchivoIndias);
MERGE (cap05)-[:OPERA_CON]->(tool65);
MERGE (cap05)-[:RESISTE_CON]->(tool56);

// 4. PUNTOS ALEPH #8 Y #9 (CONFLUENCIAS CRÍTICAS)
MERGE (a8:PuntoAleph {id: 'ALEPH_08'})
  SET a8.numero = 8,
      a8.badge = '[ALEPH #8 · LA JAULA DEL LOGOS Y LA INQUISICIÓN]',
      a8.color = '#DC2626',
      a8.region = 'Interiorización del Canon & Dogma Punitivo',
      a8.abstract = 'De la vara de medir platónica a la Inquisición medieval: el orden lógico de Grecia deviene dogma divino absoluto. La palabra deja de ser método de búsqueda y se vuelve celda punitiva. El verbo opera como el primer algoritmo: sustituye la experiencia somática viva por la adoración ciega al folio escrito.',
      a8.axioma = 'El verbo fue el primer algoritmo: codificó el mundo en palabras y nos convenció de que leer era entender.';

MERGE (a9:PuntoAleph {id: 'ALEPH_09'})
  SET a9.numero = 9,
      a9.badge = '[ALEPH #9 · EL MAPA QUE DEVORÓ LA TIERRA]',
      a9.color = '#D97706',
      a9.region = 'Modernidad Racionalista & Matriz Colonial del Dato',
      a9.abstract = 'De Gutenberg al Archivo de Indias: el nacimiento del imperio del dato. La razón ilustrada y la burocracia imperial sustituyen la selva, el cuerpo y el río por legajos administrativos sellados en Sevilla. El Choque de Archivos (Tool_65) declara superstición a toda cosmología viva que no rinda culto al papel.',
      a9.axioma = 'El dato reemplazó al dogma, pero la devoción al archivo siguió intacta. Solo cambió el altar: del templo al laboratorio.';

MERGE (a8)-[:SINTETIZA]->(cap03);
MERGE (a8)-[:SINTETIZA]->(cap04);
MERGE (a8)-[:SINTETIZA]->(tool54);
MERGE (a8)-[:SINTETIZA]->(artInquisicion);

MERGE (a9)-[:SINTETIZA]->(cap05);
MERGE (a9)-[:SINTETIZA]->(tool65);
MERGE (a9)-[:SINTETIZA]->(artArchivoIndias);
MERGE (a9)-[:SINTETIZA]->(tool56);

// 5. NODO EVALUATIVO VISIBLE EN EL GRAFO (SESIÓN 4)
MERGE (eval4:EvaluacionCriticaTGP {id: 'EVAL_CRITICA_SESION_4'})
  SET eval4.titulo = 'Dictamen Epistémico Sesión 4: La Tríada del Confinamiento Simbólico (Canon, Dogma y Burocracia Imperial)',
      eval4.autor = 'Antigravity IDE en diálogo con Xavier Benítez',
      eval4.fecha = '2026-10-27',
      eval4.badge = '[AUDITORÍA CRÍTICA SESIÓN 4]',
      eval4.color = '#84CC16',
      eval4.tesis_epistemica = 'Grecia inventa la jaula taxonómica mental (Aristóteles); la Iglesia medieval la sacraliza mediante el terror inquisitorial; la Modernidad la desacraliza pero la expande colonialmente con la imprenta y el Archivo de Indias.',
      eval4.alerta_ontologica = 'El peligro del reemplazo de la realidad por el mapa: cuando el Estado colonial cree que conocer América es apilar 40 millones de folios en Sevilla, nace la patología moderna que hoy culmina en el Big Data.',
      eval4.arqueosemiotica = 'El Archivo Solar nunca murió: solo mudó de ropa sacerdotal a sotana inquisitorial y luego a guardapolvo de científico o traje de funcionario imperial.',
      eval4.aforismo_cierre = 'Occidente no conquistó el mundo con pólvora, sino con papel sellado. El algoritmo contemporáneo es el bisnieto directo del escriba de Indias.';

MERGE (eval4)-[:AUDITA]->(a8);
MERGE (eval4)-[:AUDITA]->(a9);
MERGE (eval4)-[:CONECTA_CON]->(cap03);
MERGE (eval4)-[:CONECTA_CON]->(cap04);
MERGE (eval4)-[:CONECTA_CON]->(cap05);

RETURN 'SESIÓN 4 INGESTADA EXITOSAMENTE: CAPS 3, 4, 5, ALEPHS #8 Y #9, Y NODO EVALUATIVO REGISTRADOS' AS Status;
