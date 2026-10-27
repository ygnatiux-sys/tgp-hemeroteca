// ==============================================================================
// TGP SINAXIS GRAPH — PUNTOS ALEPH & NOTAS DE CONFLUENCIA CRÍTICA
// Nodos columnares de síntesis abstracta para visualización UI/UX en grafo
// Autor: Xavier Benítez — The Great Puzzle Project
// ==============================================================================

CREATE CONSTRAINT IF NOT EXISTS FOR (a:PuntoAleph) REQUIRE a.id IS UNIQUE;

// ALEPH #1: UMBRAL SOMÁTICO
MERGE (a1:PuntoAleph {id: 'ALEPH_01'})
  SET a1.numero = 1,
      a1.badge = '[ALEPH #1 · UMBRAL SOMÁTICO]',
      a1.color = '#F59E0B',
      a1.region = 'Origen Paleolítico & Pulsión Negentrópica',
      a1.abstract = 'El primer archivo humano no nació en una biblioteca sino en el cuerpo del primate. Las muescas de Ishango son listas sin palabras, prótesis mnemónicas de supervivencia biológica y tecnologías de consuelo ante la finitud.',
      a1.axioma = 'El primer archivo fue un acto de fe: creer que el recuerdo podía sobrevivir al cuerpo.';

// ALEPH #2: LA DESECACIÓN DEL BARRO
MERGE (a2:PuntoAleph {id: 'ALEPH_02'})
  SET a2.numero = 2,
      a2.badge = '[ALEPH #2 · LA DESECACIÓN DEL BARRO]',
      a2.color = '#EA580C',
      a2.region = 'Expropiación Teocrática & Archivo Solar',
      a2.abstract = 'En Uruk y Egipto el templo actúa como el primer servidor de datos. Para fijar la deuda y el censo, se deseca el barro húmedo al fuego, expulsando el agua para petrificar la ley. Se gana fijeza estatal pero se amputa la voz viva del pueblo.',
      a2.axioma = 'Quien domina los signos escritos, domina el destino de la comunidad.';

// ALEPH #3: CEGUERA BLANCA
MERGE (a3:PuntoAleph {id: 'ALEPH_03'})
  SET a3.numero = 3,
      a3.badge = '[ALEPH #3 · CEGUERA BLANCA]',
      a3.color = '#00EAFF',
      a3.region = 'Atmósfera Cibernética & Inversión Algorítmica',
      a3.abstract = 'El Archivo Solar culmina en la nube de silicio y la atmósfera digital ubicua. La censura ya no quema textos: opera por saturación e hipertrofia. El cuerpo humano deja de usar la prótesis y se convierte en el insumo de telemetría de la máquina.',
      a3.axioma = 'El nuevo archivo planetario no quema libros; los sepulta bajo una marea infinita de datos.';

// ALEPH #4: MEMORIA HIDRÁULICA
MERGE (a4:PuntoAleph {id: 'ALEPH_04'})
  SET a4.numero = 4,
      a4.badge = '[ALEPH #4 · MEMORIA HIDRÁULICA]',
      a4.color = '#10B981',
      a4.region = 'Resistencia Límbica & Ecología del Sentido',
      a4.abstract = 'Frente a la petrificación burocrática y el eclipse digital, el Inconsciente Hidrosimbólico reaparece a través del arte, la emoción y el olvido fértil. El archivo solo vive si circula y se rehidrata en la experiencia somática presente.',
      a4.axioma = 'No recordamos para conservar el pasado, sino para seguir vivos en el presente.';

// ALEPH #5: HUB & SPOKE ZENITAL
MERGE (a5:PuntoAleph {id: 'ALEPH_05'})
  SET a5.numero = 5,
      a5.badge = '[ALEPH #5 · HUB & SPOKE ZENITAL]',
      a5.color = '#F2C779',
      a5.region = 'Arquitectura Web & Interfaz Metodológica',
      a5.abstract = 'La plataforma thegreatpuzzleproject.com materializa su método sin rutas huérfanas: impacto existencial en 5 segundos (Home + AdnBentoGsap), cartografía de huellas en Colección CS01-CS10 y blindaje riguroso en About con Schema JSON-LD.',
      a5.axioma = 'La historia es nuestro laboratorio. La interpretación, nuestra herramienta. Comprender el presente, nuestra orientación.';

// CONEXIONES DE CONFLUENCIA CRÍTICA (ALEPH -> NODOS BASALES)
// ALEPH 1
MERGE (a1)-[:SINTETIZA]->(c1:ConceptoTGP {id: 'CONC_CONDICION_HUMANA'});
MERGE (a1)-[:SINTETIZA]->(art1:ArtefactoMaterial {id: 'ART_ISHANGO'});
MERGE (a1)-[:SINTETIZA]->(cap1:Capitulo {id: 'CAP_01'});
MERGE (a1)-[:SINTETIZA]->(t58:HerramientaTGP {id: 'TOOL_58'});

// ALEPH 2
MERGE (a2)-[:SINTETIZA]->(c2:ConceptoTGP {id: 'CONC_HERIDA_ESCISION'});
MERGE (a2)-[:SINTETIZA]->(cSolar:ConceptoTGP {id: 'CONC_ARCHIVO_SOLAR'});
MERGE (a2)-[:SINTETIZA]->(art2:ArtefactoMaterial {id: 'ART_URUK'});
MERGE (a2)-[:SINTETIZA]->(cap2:Capitulo {id: 'CAP_02'});
MERGE (a2)-[:SINTETIZA]->(t57:HerramientaTGP {id: 'TOOL_57'});

// ALEPH 3
MERGE (a3)-[:SINTETIZA]->(c3:ConceptoTGP {id: 'CONC_CEGUERA_BLANCA'});
MERGE (a3)-[:SINTETIZA]->(art3:ArtefactoMaterial {id: 'ART_NUBE_SILICIO'});
MERGE (a3)-[:SINTETIZA]->(cap6:Capitulo {id: 'CAP_06'});
MERGE (a3)-[:SINTETIZA]->(t53:HerramientaTGP {id: 'TOOL_53'});

// ALEPH 4
MERGE (a4)-[:SINTETIZA]->(t57_b:HerramientaTGP {id: 'TOOL_57'});
MERGE (a4)-[:SINTETIZA]->(t51:HerramientaTGP {id: 'TOOL_51'});
MERGE (a4)-[:SINTETIZA]->(m4:Movimiento {id: 'MOV_04'});
MERGE (a4)-[:SINTETIZA]->(cVivo:ConceptoTGP {id: 'CONC_ARCHIVO_VIVO'});

// ALEPH 5
MERGE (a5)-[:SINTETIZA]->(w1:NodoWeb {id: 'WEB_HOME'});
MERGE (a5)-[:SINTETIZA]->(w2:NodoWeb {id: 'WEB_ABOUT'});
MERGE (a5)-[:SINTETIZA]->(w3:NodoWeb {id: 'WEB_ARCHIVO'});
MERGE (a5)-[:SINTETIZA]->(w4:NodoWeb {id: 'WEB_COLECCION'});
MERGE (a5)-[:SINTETIZA]->(cCart:ConceptoTGP {id: 'CONC_CARTOGRAFIA_CRITICA'});

RETURN 'PUNTOS ALEPH Y NOTAS DE CONFLUENCIA INGESTADAS EN NEO4J' AS Status;
