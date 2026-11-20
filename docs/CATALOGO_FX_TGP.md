# Grimorio de FX Cinemáticos — The Great Puzzle Project

Catálogo permanente de motores visuales GSAP/SVG disponibles en `src/components/`.  
Todos los componentes mantienen `showHud = false` por defecto en producción (el panel de pruebas solo puede activarse en entorno local de desarrollo).

> **Cómo usarlo en un post o colección nueva:**  
> Al proponer un dossier o OOPART en TGP, elegí uno de estos 8 motores según la materialidad del objeto y montalo en modo normal (`showHud={false}`). Podés previsualizar los 8 en vivo desde el taller `/tgp-app` → **Catálogo de FX Cinemáticos** (`/lab-fx?fx=...` en desarrollo).

---

## Tabla Maestra de FXs

| # | FX / Motor | Archivo | Efecto Visual | Ideal para (Temas & OOPARTs) |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Resonancia Sónica y Refracción Espejo** | [BarabarHero.astro](../src/components/BarabarHero.astro) | Eco tipográfico en 4 capas desfasadas + destello de granito/metal pulido (*glint*). | Cámaras acústicas, superficies especulares, esferas metálicas (ej. *Esferas de Klerksdorp*, *Cuevas de Barabar*, *Espejos de obsidiana*). |
| 2 | **Mecanizado Ancestral (Corte Láser CNC)** | [PumapunkuHero.astro](../src/components/PumapunkuHero.astro) | Hilo láser cian con chispa, grilla técnica y métricas topográficas de tolerancia. | Ingeniería de precisión imposible, engranajes, bloques de andesita (ej. *Mecanismo de Anticitera*, *Puma Punku*, *Vasos predinásticos*). |
| 3 | **La Fractura Tectónica** | [TectonicHero.astro](../src/components/TectonicHero.astro) | Corte horizontal dentado en dos mitades con micro-temblor y grieta luminosa. | Monolitos partidos, piezas incrustadas en roca sedimentaria (ej. *Martillo de Londres*, *Nan Madol*, *Moais*, *Baalbek*). |
| 4 | **Paralaje de Abismo (Profundidad Z)** | [AbyssHero.astro](../src/components/AbyssHero.astro) | Caída tridimensional en eje Z hacia la oscuridad con halo cálido de antorcha y ceniza. | Galerías mineras, túneles, catacumbas, hallazgos bajo estratos profundos (ej. *Table Mountain / Calaveras*, *Derinkuyu*). |
| 5 | **Erosión Pluvial (14 Estratos Verticales)** | [PluvialHero.astro](../src/components/PluvialHero.astro) | Fragmentación vertical en 14 franjas descendentes con partículas de polvo y luz rasante. | Desgaste milenario, corrosión electroquímica, monumentos expuestos (ej. *Batería de Bagdad*, *Esfinge de Giza*). |
| 6 | **Excavación Estratigráfica (5 Estratos + GPR)** | [GunungPadangHero.astro](../src/components/GunungPadangHero.astro) | Desplazamiento horizontal en oposición de 5 estratos geológicos + choque tectónico. | Cortes de terreno, georradar, industria lítica arcaica en terrazas (ej. *Eolitos del Valle del Tajo*, *Gunung Padang*). |
| 7 | **The Blade Wipe (Barrido de Navaja)** | [BladeWipeHero.astro](../src/components/BladeWipeHero.astro) | Filo SVG diagonal dorado que corta la escena oscura y revela la obra con *camera-shake*. | Piezas de forja, metalurgia anómala, contrastes entre sombra y revelación (ej. *Pilar de Hierro de Delhi*, *Acero de Damasco*). |
| 8 | **Diagonal Canvas Scale (Apertura de Iris)** | [DiagonalScaleHero.astro](../src/components/DiagonalScaleHero.astro) | Apertura de ojo anamórfico desde el centro hacia los bordes revelando una segunda capa. | Cartografía antigua, cosmovisión, transiciones entre ruina y mapa (ej. *Mapa de Piri Reis*, *De la Cueva al Cosmos*). |

---

## Ejemplo mínimo de uso en una página `.astro`

```astro
---
import PumapunkuHero from '../components/PumapunkuHero.astro';
import imgAnticitera from '../assets/fx-samples/mecanismo-anticitera.jpg';
---

<PumapunkuHero
  image={imgAnticitera}
  title="ANTICITERA"
  subtitleWord="MECANISMO ASTRONÓMICO"
  subtitle="Tren de engranajes diferenciales en bronce helenístico"
  badge="MAR EGEO · SIGLO II A.C. · PRECISIÓN MECÁNICA"
  showHud={false}
/>
```
