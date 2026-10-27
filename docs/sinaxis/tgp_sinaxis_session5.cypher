// ==============================================================================
// TGP SINAXIS GRAPH — INGESTA SESIÓN 05 FINAL (FUENTES 13, 14, 15 Y SINOPSIS MAGISTRAL)
// La Rebelión de la Memoria (Cap. 7), La Gnosis del Sentido (Cap. 9) y Canon Museum Dark
// Incluye: NODO EVALUATIVO VISIBLE FINAL & PUNTOS ALEPH #10, #11 Y #12
// Autor: Xavier Benítez — The Great Puzzle Project
// ==============================================================================

// 1. CAPÍTULO 7: LA REBELIÓN DE LA MEMORIA (FUENTE 13)
MERGE (cap07:Capitulo {id: 'CAP_07'})
  SET cap07.titulo = 'La rebelión de la memoria',
      cap07.subtitulo = 'El retorno del agua interior',
      cap07.tesisFactual = 'Sospecha ontológica del siglo XXI: el archivo digital reproduce pero no recuerda; desmonumentalización del arte, activismo sensible y confirmación neurocientífica de que sin emoción no hay memoria.',
      cap07.disonancia = 'La cultura del historial y la pérdida del borrador: la hiperconsistencia del dato amputa la fragilidad creativa y criminaliza el olvido, impidiendo el perdón y la metamorfosis.',
      cap07.sintesisTGP = 'Activación de la Retrogénesis del Sentido (Tool_55): descenso al humedal límbico para rehidratar el archivo (Tool_57) y mutar del depósito al ecosistema vivo (Tool_51).',
      cap07.aforismo = 'La memoria no se conserva: se cultiva. Y como toda agua viva, solo fluye cuando se comparte.';

// 2. CAPÍTULO 9: LA GNOSIS DEL SENTIDO (FUENTE 14)
MERGE (cap09:Capitulo {id: 'CAP_09'})
  SET cap09.titulo = 'La Gnosis del Sentido',
      cap09.subtitulo = 'Del archivo muerto al archivo vivo',
      cap09.tesisFactual = 'Constante transhistórica del recuerdo del origen (anamnesis, memoria Dei, samadhi); giro centrípeto tras siglos de exteriorización solar y epistemología de la resonancia interior.',
      cap09.disonancia = 'Ceguera existencial del Big Data: predice compras y miedos con exactitud, pero es incapaz de comprender el consuelo o el amor; el exceso de saber produce un vacío más hondo que la ignorancia.',
      cap09.sintesisTGP = 'Gran Confluencia del Canon E: unificación de Tool_51, Tool_53, Tool_56 y Tool_57; el ser humano comprende que no está frente al archivo, sino que él mismo es el archivo encarnado.',
      cap09.aforismo = 'Cuando la memoria se reconcilia con el olvido, el archivo vuelve a respirar. Y en ese pulso —entre agua y forma— la conciencia reconoce su destino: recordar es crear.';

// 3. CANON MAESTRO MUSEUM DARK (FUENTE 15)
MERGE (canonEdc:CanonEditorial {id: 'CANON_MUSEUM_DARK'})
  SET canonEdc.nombre = 'Canon Maestro TGP v1.9 — Estética Museum Dark',
      canonEdc.obra = 'Historia del Archivo (Libro 1, Serie E)',
      canonEdc.paleta = 'Negro grafito (#0A0D14), Cian brillante (#00EAFF), Oro tenue (#F2C779), Titanio (#F9F9F9)',
      canonEdc.tipografias = 'Neue Montreal Bold (H1), IBM Plex Sans SemiBold (H2), Lora Regular (Cuerpo 80%)',
      canonEdc.glifos = 'cerebro, tablilla, sol-luna, ojo, chip, gota, archivo',
      canonEdc.volumenII = 'La Rebelión de la Memoria (Donde el alma se libera del archivo y vuelve a hablar en agua)';

// 4. SINOPSIS MAGISTRAL Y BIOGRAFÍA SECRETA (BLOQUE 6)
MERGE (sinopsis:SinopsisMagistral {id: 'SINOPSIS_BIOGRAFIA_MEMORIA'})
  SET sinopsis.titulo = 'Del barro al algoritmo: la biografía secreta de nuestra memoria',
      sinopsis.autor = 'Xavier Benítez',
      sinopsis.arco_temporal = '20.000 años (De Ishango al Big Data y la IA)',
      sinopsis.conflicto = 'La escisión ontológica: congelar la vida en un soporte para salvarla del olvido amputa el pulso vivo y la voz que se quería proteger.',
      sinopsis.resolucion = 'Durante milenios creímos que la memoria necesitaba custodios; hoy descubrimos que necesita oyentes somáticos.';

// 5. PUNTOS ALEPH FINALES (#10, #11 Y #12)
MERGE (a10:PuntoAleph {id: 'ALEPH_10'})
  SET a10.numero = 10,
      a10.badge = '[ALEPH #10 · LA PÉRDIDA DEL BORRADOR]',
      a10.color = '#06B6D4',
      a10.region = 'Retrogénesis Somática & Cultura del Historial',
      a10.abstract = 'En la era digital, la vida perdió su borrador: cada contradicción y error queda petrificado en el historial algorítmico, destruyendo el olvido biológico y el perdón. La Rebelión de la Memoria activa la Retrogénesis (Tool_55): el descenso al humedal afectivo para reaprender a sentir en comunidad.',
      a10.axioma = 'La memoria no se conserva: se cultiva. Y como toda agua viva, solo fluye cuando se comparte.';

MERGE (a11:PuntoAleph {id: 'ALEPH_11'})
  SET a11.numero = 11,
      a11.badge = '[ALEPH #11 · LA GNOSIS DEL SENTIDO Y EL ARCHIVO VIVO]',
      a11.color = '#14B8A6',
      a11.region = 'Gran Confluencia Gnoseológica & Resonancia',
      a11.abstract = 'Culminación del Método TGP: unificación de la Ecología del Sentido (Tool_51), la Dialéctica Solar-Lunar (Tool_53), la Hidromemoria (Tool_56) y el Inconsciente Hidrosimbólico (Tool_57). El archivo deja de ser la jaula del logos para volverse órgano vivo del alma planetaria. El humano no está frente al archivo: él es el archivo.',
      a11.axioma = 'Cuando la memoria se reconcilia con el olvido, el archivo vuelve a respirar. Recordar es crear.';

MERGE (a12:PuntoAleph {id: 'ALEPH_12'})
  SET a12.numero = 12,
      a12.badge = '[ALEPH #12 · EL CÓDICE MUSEUM DARK]',
      a12.color = '#F59E0B',
      a12.region = 'Encarnación Editorial & Puente al Volumen II',
      a12.abstract = 'Materialización estética del pensamiento TGP: contraste Museum Dark (#0A0D14 / cian #00EAFF) y los 7 glifos arquetípicos. Clausura de la crónica solar del logos (Volumen I) y apertura al océano lunar de La Rebelión de la Memoria (Volumen II).',
      a12.axioma = 'Cada palabra que pronunciamos es un fósil de luz. Cada silencio, una semilla de agua. Y entre ambos crece el árbol invisible del sentido.';

MERGE (a10)-[:SINTETIZA]->(cap07);
MERGE (a10)-[:SINTETIZA]->(tool55);
MERGE (a10)-[:SINTETIZA]->(tool57);

MERGE (a11)-[:SINTETIZA]->(cap09);
MERGE (a11)-[:SINTETIZA]->(tool51);
MERGE (a11)-[:SINTETIZA]->(tool53);
MERGE (a11)-[:SINTETIZA]->(tool56);

MERGE (a12)-[:SINTETIZA]->(canonEdc);
MERGE (a12)-[:SINTETIZA]->(sinopsis);

// 6. NODO EVALUATIVO VISIBLE FINAL (DICTAMEN CUMBRE DEL CORPUS)
MERGE (evalFinal:EvaluacionCriticaTGP {id: 'EVAL_CRITICA_SESION_5_FINAL'})
  SET evalFinal.titulo = 'Dictamen Epistémico Cumbre: La Reconciliación del Fuego y del Agua (El Archivo Encarnado)',
      evalFinal.autor = 'Antigravity IDE en diálogo con Xavier Benítez',
      evalFinal.fecha = '2026-10-27',
      evalFinal.badge = '[AUDITORÍA CRÍTICA FINAL — 14 FUENTES]',
      evalFinal.color = '#6366F1',
      evalFinal.tesis_epistemica = 'La trayectoria de 20.000 años se cierra con una victoria ontológica: el archivo no se destruye ni se idolatra; se encarna. Al demostrar que el Big Data es ciego al amor y al consuelo, TGP rescata el cuerpo y el afecto como el archivo irreductible.',
      evalFinal.alerta_ontologica = 'Peligro de la hipermnesia digital: un mundo sin borrador es un mundo sin perdón ni creación. El olvido no es una falla del sistema biológico, sino su tecnología más avanzada de renovación.',
      evalFinal.sintesis_metodologica = 'La Gran Confluencia TGP: el logos solar (precisión documental, arqueosemiótica, IA) y la memoria lunar (respiración somática, vínculo, inconsciente hidrosimbólico) dejan de combatir y se integran en la Ecología del Sentido (Tool_51).',
      evalFinal.aforismo_cierre = 'No estamos parados frente a la historia: nosotros somos el archivo en su forma viva. El misterio no es lo que el tiempo borró, sino el fuego con el que seguimos tallando sentido en la noche.';

MERGE (evalFinal)-[:AUDITA]->(a10);
MERGE (evalFinal)-[:AUDITA]->(a11);
MERGE (evalFinal)-[:AUDITA]->(a12);
MERGE (evalFinal)-[:CORONA_A]->(sinopsis);

RETURN 'CORPUS COMPLETO (14 FUENTES) INGESTADO Y CERRADO EXITOSAMENTE' AS Status;
