# PowerShell script to audit and populate clean, simple, direct Spanish deks for all items missing dek

$directories = @(
    "src\content\ensayos",
    "src\content\arquetipos-globales",
    "src\content\georreferencias",
    "src\content\ensayos-cinematicos"
)

$defaultDeks = @{
    # Ensayos Cinemáticos
    "bonampak-el-fin-del-idealismo-maya" = "Los murales que revelaron la cara más cruda, ritual y bélica del mundo clásico maya."
    "dossier-inicial-obsidiana" = "Un recorrido visual por los fundamentos simbólicos y la memoria arcaica del proyecto TGP."
    "el-aguara-guazu-sudamericano" = "El cánido solitario de los pastizales sudamericanos: mitos, biología y supervivencia."
    "el-gato-montes-salvaje-argentino" = "El sigiloso felino de monte: adaptabilidad, territorio y presencia en la fauna nativa."
    "el-nandu-pampeano" = "El corredor de las grandes llanuras: historia natural y simbolismo del avestruz americano."
    "el-tango-argentino" = "Del arrabal portuario a símbolo universal: la evolución musical y poética del arrabal rioplatense."
    "el-tapir" = "El gran mamífero herbívoro de las selvas: rol ecológico y raíces prehistóricas."
    "el-tatu-carreta" = "El gigante acorazado del Chaco: excavador maestro y fósil viviente de la fauna sudamericana."
    "el-tero" = "El centinela de los campos: comportamiento territorial, alarmas sonoras y arraigo popular."
    "la-perdiz-bonaerense" = "El ave de pastizal y su mimetismo en los campos pampeanos."
    "los-tipos-de-vacas-en-argentina" = "Genética, historia ganadera y el desarrollo de las razas que forjaron la pampa."
    "pueblos-azules-los-hunza2" = "Longevidad, aislamiento y tradiciones ancestrales en los valles del Himalaya."

    # Georreferencias
    "aramu-muru-puerta-de-los-dioses" = "El portal tallado en roca en las orillas del lago Titicaca y sus leyendas de paso interdimensional."
    "capacete-brasil" = "El misterioso monolito rocoso y su carga simbólica en el paisaje etnográfico brasileño."
    "cueva-de-altamira" = "La capilla sixtina del arte rupestre: policromía y espiritualidad en el Paleolítico cantábrico."
    "cueva-de-las-manos-patagonia" = "Miles de años de huellas humanas impresas en las paredes del cañadón del Río Pinturas."
    "isla-de-los-estados" = "El confín más salvaje del Atlántico Sur: naufragios, faros y naturaleza indómita."
    "isla-de-los-estados-en-tierra-del-fuego" = "Crónicas del faro del fin del mundo y los mares tempestuosos de Tierra del Fuego."
    "la-cueva-de-lascaux" = "El santuario rupestre del sudoeste francés: técnica, fauna extinta y rito prehistórico."
    "meroe-la-dinastia-egipcia-nubia" = "Las pirámides del reino de Kush y el legado de los faraones negros del Nilo medio."
    "meroe-sudan" = "Ruinas imperiales de Nubia: metalurgia, comercio y poder en el corazón de Sudán."
    "meroe-y-la-dinasta-negra-el-cdice-de-las-pirmides-nubias" = "El códice de las pirámides nubias y el reinado de los monarcas de Meroe."
    "olumo-rock" = "La fortaleza natural de piedra sagrada del pueblo Egba en Nigeria."
    "pedra-do-inga-mgzn" = "Inscripciones rupestres no descifradas y enigmas arqueoastronómicos en Paraíba."
    "pedra-inga" = "El monumento con bajorrelieves zoomorfos y astronómicos del nordeste de Brasil."
    "pedra-inga-1" = "Análisis arqueosemiótico de los glifos tallados en la gran roca de Ingá."
    "santuario-de-ballenas-peninsula-de-valdez" = "El refugio marino de la ballena franca austral en las costas patagónicas."
    "santuario-de-ballenas-peninsula-de-valdez-patagonia" = "Conservación y ciclo reproductivo de la fauna marina en Península Valdés."
    "stonehenge" = "El círculo megalítico de Salisbury: astronomía sagrada, arquitectura de piedra y culto solar."
    "valle-de-la-luna" = "Ischigualasto y sus formaciones triásicas: el registro fósil más completo del origen de los dinosaurios."
    "yonaguni" = "Las terrazas y bloques sumergidos frente a Japón: debate entre geología marina y ruinas arcaicas."

    # Arquetipos Globales
    "arquetipos-globales-introduccion" = "Fundamentos del inconsciente colectivo y los patrones que conectan a todas las culturas."
    "carl-jung-biografia" = "Vida, método y descubrimientos del pionero de la psicología analítica."
    "demeter2" = "El ciclo de las estaciones, el rapto de Perséfone y los misterios de la fertilidad agraria."
    "la-torre-de-babel" = "El mito de la soberbia humana, la confusión de las lenguas y la dispersión cultural."
    "los-annunaki" = "Los dioses mesopotámicos del panteón sumerio y su reinterpretación contemporánea."
    "los-annunakis" = "Cosmología y mitología sumeria sobre las deidades primordiales del cielo y la tierra."
    "los-orixas" = "Fuerzas de la naturaleza, linajes sagrados y sabiduría viva del panteón yoruba."
    "los-orixas-africanos" = "La herencia espiritual africana y la cosmovisión de las divinidades yorubas."
    "saturno-y-la-astrologia" = "El arquetipo del tiempo, los límites, la disciplina y la melancolía filosófica."

    # Ensayos generales
    "1984-la-prediccion-de-orwell" = "Vigilancia, manipulación del lenguaje y el control totalitario de la mente humana."
    "7-pecados-7-chackras" = "Paralelismos simbólicos entre los centros energéticos de Oriente y los vicios capitales de Occidente."
    "america-invertida" = "El célebre mapa de Joaquín Torres García que redefinió el norte simbólico del continente."
    "atila-y-el-papa" = "El encuentro legendario en el río Mincio entre Atila el Huno y el papa León Magno."
    "atila-y-el-papa-1" = "La diplomacia, el pánico y el poder de persuasión en el colapso del Imperio Romano."
    "bonampak" = "Pintura mural, sacerdotes y guerra en el corazón de la selva lacandona."
    "bonampak-1" = "Crónica visual de la vida cortesana y las ceremonias mayas en Bonampak."
    "bonampak-2" = "Detalles iconográficos y rituales de los frescos mayas en el Templo de los Murales."
    "del-cosmos-a-la-luna" = "La carrera espacial como metáfora del anhelo humano por traspasar sus propias fronteras."
    "el-ankh-egipcio" = "El jeroglífico de la vida eterna: orígenes, simbolismo y poder en el Antiguo Egipto."
    "el-diablo-en-el-tarot" = "La carta de la atadura, el instinto y las pulsiones ocultas de la psique."
    "el-diablo-en-el-tarot-1" = "Lectura simbólica del arcano XV: sombras, deseo e iluminación por confrontación."
    "el-mito-de-sisifo" = "Camus y el absurdo: encontrar sentido y rebelión en el esfuerzo incesante de la existencia."
    "el-qapaq-nan-una-obra-de-ingenieria-arcaica-asombroso-en-las-entranas-de-sudamerica" = "La red vial andina que unió montañas, costas y selvas a lo largo de miles de kilómetros."
    "el-simbolismo-del-laberinto" = "El viaje iniciático, el monstruo interior y el camino hacia el centro de uno mismo."
    "gengis-khan" = "El estratega mongol que unificó las estepas y forjó el mayor imperio contiguo del mundo."
    "hegel-la-historia-y-dios" = "La dialéctica del espíritu y el desarrollo de la conciencia a través del tiempo."
    "homero-el-poeta-ciego" = "La Ilíada, la Odisea y la forja de la identidad mitológica y heroica de Grecia."
    "isis-los-misterios-del-iniciacion" = "El culto a la gran madre egipcia y sus ritos de resurrección en el mundo helenístico."
    "julio-cesar-y-los-galos-2" = "Estrategia militar, asedios y la anexión de las tribus galas a la órbita romana."
    "julio-cesar-y-los-galos-2026" = "Análisis táctico de la Guerra de las Galias y el ascenso político de César."
    "la-arquitectura-de-los-suenos-lucidos" = "Mecanismos neurológicos, control consciente y exploración del mundo onírico."
    "la-caida-de-cartago" = "El asedio romano del 146 a.C. y la destrucción definitiva de la gran potencia púnica."
    "la-chilinga" = "El tambor comunitario, las raíces del candombe y la percusión como lenguaje colectivo."
    "la-estetica-del-silencio" = "El valor del vacío y la pausa en el arte, la música y la contemplación."
    "los-carpocracianos" = "La secta gnóstica del siglo II que desafió las normas morales de su época."
    "los-carpocracianos-1" = "Doctrina de la transgresión y búsqueda de la liberación espiritual en el gnosticismo."
    "los-esenios-mgzn" = "La comunidad ascética del Mar Muerto y sus manuscritos que iluminan el origen del cristianismo."
    "los-nestorianos" = "La vertiente cristiana de las dos naturalezas de Cristo que se expandió hasta China."
    "los-nestorianos-1" = "Misiones, monasterios y rutas comerciales de la Iglesia del Oriente a través de Asia."
    "moctezuma-y-cortez-el-ultimo-azteca" = "El choque de dos mundos en Tenochtitlan y el fin del Imperio Mexica."
    "nag-hammadi-abril-2026" = "El hallazgo de los evangelios gnósticos que reescribieron la historia del cristianismo temprano."
    "neoplatonicos" = "Plotino, el Uno y el retorno del alma a su fuente primordial mediante la filosofía."
    "neron-y-roma" = "Poder, exceso y el incendio que transformó el destino del Imperio Romano."
    "osiris-el-dios-verde" = "La deidad de la resurrección, la fertilidad del Nilo y el juicio de las almas."
    "qumram-2026" = "Las cuevas del desierto de Judea y los rollos que conservaron textos bíblicos milenarios."
    "saber-es-recordar-la-teoria-de-platon" = "La reminiscencia platónica y el acceso al mundo de las Ideas."
    "san-agustin-y-su-pasado" = "De los placeres de Cartago y el maniqueísmo a las Confesiones y la teología clásica."
    "schlieman-y-el-descubrimiento-de-troya" = "La obsesión de un comerciante con los versos de Homero que desenterró Troya y Micenas."
    "simon-el-estilita" = "El ermitaño sirio que vivió décadas sobre una columna en busca de santidad extrema."
    "socrates2" = "El método mayéutico, la ironía y el juicio que condenó a muerte al padre de la filosofía occidental."
    "the-atacama-mummy" = "Momificación chinchorro en el desierto más árido del planeta: un rito milenario previo a Egipto."
    "the-mask" = "Antropología del rostro cubierto: ocultamiento, transformación y poder sagrado en el ritual."
    "tikal" = "Las pirámides que se elevan sobre el dosel de la selva en el corazón del reino maya."
    "tikal-1" = "Auge y caída de la gran metrópoli maya del Petén guatemalteco."
    "ulyses-y-las-sirenas" = "El canto mortal de las sirenas y la astucia del héroe que desafió la perdición."
}

$updated = 0

foreach ($dir in $directories) {
    if (Test-Path $dir) {
        $subdirs = Get-ChildItem -Path $dir -Directory
        foreach ($s in $subdirs) {
            $jsonPath = Join-Path $s.FullName "index.json"
            if (Test-Path $jsonPath) {
                try {
                    $content = Get-Content $jsonPath -Raw -Encoding UTF8
                    $json = $content | ConvertFrom-Json
                    
                    $slug = $s.Name
                    $hasDek = ($null -ne $json.dek) -and ($json.dek.ToString().Trim() -ne "")

                    if (-not $hasDek) {
                        # Determine simple, direct dek
                        $newDek = ""
                        if ($defaultDeks.ContainsKey($slug)) {
                            $newDek = $defaultDeks[$slug]
                        } elseif ($null -ne $json.excerpt -and $json.excerpt.ToString().Trim() -ne "") {
                            $clean = $json.excerpt.ToString().Replace("**", "").Replace('"', "").Trim()
                            # Take first sentence if too long
                            $firstSentence = ($clean -split "\.")[0] + "."
                            if ($firstSentence.Length -lt 140 -and $firstSentence.Length -gt 25) {
                                $newDek = $firstSentence
                            } else {
                                $newDek = $clean
                            }
                        } else {
                            $title = $json.title
                            $newDek = "Exploración e investigación archivística sobre $title en la hemeroteca TGP."
                        }

                        $json | Add-Member -NotePropertyName "dek" -NotePropertyValue $newDek -Force
                        $updatedJson = $json | ConvertTo-Json -Depth 10
                        [System.IO.File]::WriteAllText($jsonPath, $updatedJson, [System.Text.Encoding]::UTF8)
                        $updated++
                        Write-Host "Updated ($slug): $newDek"
                    }
                } catch {
                    Write-Warning "Error processing $jsonPath : $_"
                }
            }
        }
    }
}

Write-Host "Total files updated with clean dek: $updated"
