// ==============================================================================
// TGP SINAXIS GRAPH — INGESTA SESIÓN 02 (FUENTES 04, 05 Y 06)
// Capítulos: 1 (El impulso de guardar), 6 (El Archivo Planetario), 2 (Del templo al palacio)
// Motor: Neo4j (Cypher) / Constraints de unicidad previamente creados
// Autor: Xavier Benítez — The Great Puzzle Project
// ==============================================================================

// 1. HERRAMIENTAS CONCEPTUALES Y METODOLÓGICAS ACTIVADAS
MERGE (tool53:HerramientaTGP {id: 'TOOL_53'})
  SET tool53.codigo = 'Tool_53',
      tool53.nombre = 'Dialéctica Solar-Lunar & Eclipse del Sentido',
      tool53.definicion = 'Superposición crítica donde el máximo acceso a datos coincide con la mínima capacidad de interpretar en profundidad; polaridad entre la luz desecante del archivo y la sombra fértil de la memoria viva.';

MERGE (tool57:HerramientaTGP {id: 'TOOL_57'})
  SET tool57.codigo = 'Tool_57',
      tool57.nombre = 'Inconsciente Hidrosimbólico',
      tool57.definicion = 'El sustrato líquido, afectivo y disolvente de la memoria humana que subyace y erosiona todo soporte material (barro húmedo, tinta, papiro, sangre, lágrima, código binario).';

// 2. CONCEPTOS ATÓMICOS EMERGENTES (BLOQUE 2)
MERGE (cAnimalArch:ConceptoTGP {id: 'CONC_ANIMAL_ARCHIVADOR'})
  SET cAnimalArch.nombre = 'Animal Archivador',
      cAnimalArch.eje = 'Antropología Somática',
      cAnimalArch.definicion = 'Condición ontológica del ser humano cuya identidad depende estructuralmente de los sistemas externos que lo recuerdan.',
      cAnimalArch.axioma = 'El archivo nació como refugio, pero llevó a la humanidad a confundir el registro con la vida.';

MERGE (cHeridaMem:ConceptoTGP {id: 'CONC_HERIDA_ESCISION'})
  SET cHeridaMem.nombre = 'Escisión Ontológica de la Memoria',
      cHeridaMem.eje = 'Arqueosemiótica',
      cHeridaMem.definicion = 'Herida original entre la experiencia viva y el signo que la fija: inmortaliza el registro a cambio de amputar la voz, el tono y el pulso somático.',
      cHeridaMem.axioma = 'Todo lo que se fija en un soporte deja de fluir y congela la vida que lo generó.';

MERGE (cCegueraBlanca:ConceptoTGP {id: 'CONC_CEGUERA_BLANCA'})
  SET cCegueraBlanca.nombre = 'Ceguera Blanca y Censura por Saturación',
      cCegueraBlanca.eje = 'Biopolítica del Silicio',
      cCegueraBlanca.definicion = 'Mutación contemporánea del control: el exceso hipertrófico de información produce el mismo efecto que el olvido y ahoga el discernimiento en un scroll perpetuo.',
      cCegueraBlanca.axioma = 'El nuevo archivo planetario no quema libros; los sepulta bajo una marea infinita de datos.';

MERGE (cArchivoSolar:ConceptoTGP {id: 'CONC_ARCHIVO_SOLAR'})
  SET cArchivoSolar.nombre = 'Archivo Solar',
      cArchivoSolar.eje = 'Sociología del Poder',
      cArchivoSolar.definicion = 'Arquitectura simbólica de verticalidad, fijeza y claridad punitiva que excluye las sombras y centraliza el gobierno del tiempo en templos, palacios y servidores.',
      cArchivoSolar.axioma = 'Quien domina los signos escritos, domina el destino de la comunidad.';

// 3. CAPÍTULO 1: EL IMPULSO DE GUARDAR (FUENTE 04)
MERGE (cap01:Capitulo {id: 'CAP_01'})
  SET cap01.titulo = 'El impulso de guardar',
      cap01.subtitulo = 'Del rastro al archivo',
      cap01.tesisFactual = 'Marcas prehistóricas y huesos con muescas como sistemas de contabilidad emocional anteriores al lenguaje articulado.',
      cap01.disonancia = 'La fijación del signo amputa el canto, el gesto y la memoria somática comunal.',
      cap01.sintesisTGP = 'El primer archivo humano estuvo en el cuerpo (pulso, tambor, respiración); su delegación en la materia inició una cesión negentrópica.';

MERGE (artIshango:ArtefactoMaterial {id: 'ART_ISHANGO'})
  SET artIshango.nombre = 'Huesos de Lebombo e Ishango',
      artIshango.datacion = 'Paleolítico Superior (> 20.000 AP)',
      artIshango.funcionOriginal = 'Listas sin palabras que registraban ciclos lunares y ritmos biológicos que la mente no podía retener sola.',
      artIshango.significadoTGP = 'Tecnología de consuelo frente a la finitud y el olvido biológico.';

MERGE (cap01)-[:ANCLADO_EN]->(artIshango);
MERGE (cap01)-[:ABRE_HERIDA]->(cHeridaMem);
MERGE (cap01)-[:MODELA_A]->(cAnimalArch);
MERGE (cap01)-[:OPERA_CON]->(tool58);

// 4. CAPÍTULO 2: DEL TEMPLO AL PALACIO (FUENTE 06)
MERGE (cap02:Capitulo {id: 'CAP_02'})
  SET cap02.titulo = 'Del templo al palacio',
      cap02.subtitulo = 'El archivo se vuelve poder',
      cap02.tesisFactual = 'Uruk, Lagash y Egipto: la invención del escriba y la transformación del registro comunal en instrumento fiscal y teocrático.',
      cap02.disonancia = 'Asimetría del saber: sacralización punitiva del soporte y mercantilización de la salvación (Libro de los Muertos).',
      cap02.sintesisTGP = 'Templo = base de datos con altar. Palacio = algoritmo temprano diseñado para archivar obediencia.';

MERGE (artUruk:ArtefactoMaterial {id: 'ART_URUK'})
  SET artUruk.nombre = 'Tablillas cuneiformes y sellos cilíndricos',
      artUruk.datacion = '~3200 a.C. (Mesopotamia)',
      artUruk.contexto = 'Templo de Enki / Palacio Real',
      artUruk.significadoTGP = 'Materialización del tributo: el barro húmedo se deseca al horno para petrificar la deuda.';

MERGE (cap02)-[:ANCLADO_EN]->(artUruk);
MERGE (cap02)-[:ENGENDRA]->(cArchivoSolar);
MERGE (cap02)-[:SUBORDINADO_A]->(tool57); // El barro húmedo y el papiro evidencian el sustrato líquido
MERGE (cap02)-[:DIALECTICA_CON]->(tool53);

// 5. CAPÍTULO 6: EL ARCHIVO PLANETARIO (FUENTE 05)
MERGE (cap06:Capitulo {id: 'CAP_06'})
  SET cap06.titulo = 'El Archivo Planetario',
      cap06.subtitulo = 'La memoria global y la ilusión de lo total',
      cap06.tesisFactual = 'Desmaterialización del mármol al silicio: Internet, Google, Wikipedia y la ubicuidad atmosférica del dato.',
      cap06.disonancia = 'Censura por saturación, disolución de la historia en scroll y biopolítica de la vigilancia biométrica algorítmica.',
      cap06.sintesisTGP = 'Culminación del Archivo Solar como Ceguera Blanca; el retorno del Inconsciente Hidrosimbólico en las grietas del código.';

MERGE (artSilicio:ArtefactoMaterial {id: 'ART_NUBE_SILICIO'})
  SET artSilicio.nombre = 'Servidores de Silicio, Redes Neuronales y Telemetría Biométrica',
      artSilicio.datacion = 'Siglos XX-XXI',
      artSilicio.tipo = 'Atmósfera ubiqua de registro inmaterial',
      artSilicio.significadoTGP = 'El archivo emancipado del edificio físico que convierte al usuario en insumo de datos.';

MERGE (cap06)-[:ANCLADO_EN]->(artSilicio);
MERGE (cap06)-[:DESEMBOCA_EN]->(cCegueraBlanca);
MERGE (cap06)-[:PRODUCE_PARADOJA]->(tool53); // Eclipse del Sentido
MERGE (cap06)-[:REACTIVA_RESISTENCIA]->(tool57); // Inconsciente Hidrosimbólico

// 6. RELACIONES TRANSVERSALES ENTRE CAPÍTULOS (VECTOR EVOLUTIVO TGP)
// El puente simétrico entre el hueso paleolítico y el silicio
MERGE (artIshango)-[:MUTACION_TECNOLOGICA {despojoSomático: 'Máximo'}]->(artSilicio);
MERGE (cap01)-[:METAMORFOSIS_BIOPOLITICA]->(cap02);
MERGE (cap02)-[:ESCALA_PLANETARIA]->(cap06);
MERGE (cArchivoSolar)-[:CULMINACION_HIPERTROFICA]->(cCegueraBlanca);

RETURN 'SINAXIS TGP - BLOQUE 2 (FUENTES 4, 5 Y 6) MERGEADO EXITOSAMENTE' AS Status;
