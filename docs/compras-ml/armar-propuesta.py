# Arma la propuesta de productos de Mercado Libre que faltan en el POS (20-10-2026).
# Datos: compras de ML del último año (leídas de la cuenta del dueño), costo = "precio con descuento"
# de cada línea / unidades (el cupón ya viene repartido por ML).
import json, math, re

RAW = r"""
3|F|2026-10-10|1|23990|Calculadora Casio Científica Fx-570laplus Negra Gris
4|F|2026-10-10|5|8200|Soplador Usb Portátil Mohits 200w 130000rpm 5000mah 3 Velocidades Recargable Negro
15|D|2026-09-22|2|8990|Pack X 10 Gancho Metálico Góndola 25cm Plateado
23|D|2026-09-03|3|3990|Tela Crea Cruda 100% Algodón Especial Para Bordar
27|F|2026-08-25|4|3040|Cable Usb Tipo C A Tipo C 2m Carga Rápida 60w Datos 2.0 Negro
31|F|2026-08-24|10|5323|Plancha Vapor Vertical Ropa 4 En 1 Vaporizador Sauna Facial Blanco
34|F|2026-08-24|5|4962|Luz Solar Portátil Led Magicstore 100w 10000lm Ip66 Luz Emergencia Naranja
38|F|2026-08-24|3|9337|Llave Agua Caliente Eléctrico Lavaplatos Blanco
40|F|2026-08-24|1||20 Rollos Papel Adhesivo Térmico Para Mini Impresora 57mm Blanco
41|D|2026-08-24|1||Dispensador De Jabón Líquido Nobre 350 Ml Blanco
42|D|2026-08-24|1|2990|Dispensador Jabon Automático Bomba Detergente Lavaloza Blanco
43|D|2026-08-24|1|9309|Set 10 Tijeras Cortar Pelo Entresacadora Peluquería
44|D|2026-08-24|2||Set 3 Taper Tupper Hermético Comida Gris
45|D|2026-08-24|1||Colador Escurridor De Alimentos Silicona Gris
46|D|2026-08-24|1|4792|Colador Y Tapón De Acero Inoxidable Para Lavaplatos
47|D|2026-08-24|1||Mini Paralelas De Madera Calistenia Fitness
48|D|2026-08-24|1|10990|Espejo De 3 Vías De Maquillaje 360° Plateado
50|D|2026-08-24|1|8540|Set 3 Tazas Medidoras Vasos Medidores
52|D|2026-08-24|1||Jarro 4 Litros Plástico Con Tapa
57|D|2026-08-15|3|2800|Aceite De Oliva Extra Virgen 500ml Olivaz
58|D|2026-08-15|1|11990|Magnesio Triple Düa Labs 120 Cápsulas
59|D|2026-08-15|2|16990|Omega 3 Düa Labs 120 Cápsulas
61|D|2026-08-14|1|28896|Freidora De Aire 4.2 Litros 1200w Homen Negro
62|F|2026-08-14|2||Transformador 12v 1a Para Cámaras CCTV Tecnomati
63|F|2026-08-14|5||Adaptador Splitter SATA Poder A Doble SATA 1 In 2 Out
65|F|2026-08-14|2|3358|Fuente De Poder Adaptador Transformador DC 5v 2a Negro
66|F|2026-08-14|2||Tester Cable Red UTP LAN Teléfono RJ45 RJ11 Tecnomati
68|F|2026-08-14|2||Fuente Transformador 12v 2.0A CCTV DVR Cámaras
69|F|2026-08-14|8|2372|Cable De Poder Para UPS Y PC Extensión 1.8m C14 C13 Negro
70|F|2026-08-14|5|5690|Cargador Adaptador Universal Laptop Computador 8 Marcas Negro
72|F|2026-08-14|6|3420|Switch HDMI 3 Entradas 1 Salida 3x1 Full HD
75|F|2026-08-14|3|3987|Cable USB C Carga Rápida Para iPhone 11 12 13 14 Blanco
78|F|2026-08-14|5|5500|Splitter HDMI Activo 1 X 4 1080p 4 Salidas Gadnic
80|F|2026-08-14|3|8990|Timbre Inalámbrico 300m Exterior Impermeable Receptor Enchufable
83|F|2026-08-03|30|1370|Cable De Alimentación Trébol Para Fuentes De Poder Y Cargadores
84|D|2026-07-29|1|14990|Basurero 50lt Con Tapa Y Pedal Gris
99|F|2026-07-23|5||Panel LED Redondo 12w Sobrepuesto Luz Fría 6000k Con Driver
107|F|2026-07-23|5|16795|Aro De Luz LED 45 Cm Con Trípode 2 M Y Soporte Para Teléfono Negro
108|F|2026-07-23|5|8436|Aro De Luz LED Grande 31cm Con Trípode 2.1m Blanco
111|F|2026-07-23|5||Cámara De Vigilancia IP WiFi 1mp LAN 92° Remoto Negro
112|F|2026-07-23|2|6644|Wafflera Redonda Para Repostería Y Desayuno
113|F|2026-07-23|2||Pesa Balanza Digital Gramera De Precisión Joyería Portátil
116|D|2026-07-17|1|11990|Mesa Plegable Auxiliar Portátil Exterior 60cm
117|D|2026-07-11|1|39990|Secador De Pelo Remington Coconut Therapy AC-8607
120|F|2026-07-11|3|1352|Pastillero Mañana Tarde Noche 3 Tomas
121|F|2026-07-11|2|9900|Tendedero Colgador Ropa Plegable Multicolor
122|D|2026-07-11|1||Set 3 Plumones Pizarra Con Borrador
123|F|2026-07-11|9|4292|Juego De Destornilladores 117 En 1 Multifunción
124|F|2026-07-11|3|2390|Pastillero Semanal 4 Tomas Diarias
125|F|2026-07-11|10||Cepillo Automático Para Gatos A Vapor 3 En 1 Verde
126|F|2026-07-11|5|2969|Pack X2 Oxímetro Saturómetro Pulsómetro
130|F|2026-07-11|2||Kit De Herramientas Para Redes Crimpeadora Pelacable RJ45
131|F|2026-07-11|3|1790|Llave Ajustable Gasfitería Multiuso Flexible Desagüe
132|F|2026-07-11|3||Tester Multímetro Digital Pantalla LCD XL-830L
133|F|2026-07-11|2||Termostato Digital STC-1000 Control Temperatura
134|D|2026-07-11|1||Probador De Enchufes 90-250v Negro
135|F|2026-07-11|3|6251|Kit Cautín Soldador 60w Punta Lápiz Temperatura Regulable
136|F|2026-07-11|3||Máquina Soldadora Grapadora De Plástico Caliente 50w Rojo
137|F|2026-07-11|3|6990|Ducha Bidet Árabe WC Acero Inoxidable Kit
138|F|2026-07-11|3||Termómetro Higrómetro Ambiental Con Reloj Y Alarma
139|D|2026-07-11|1||Enchufe Probador Tester Electricidad
140|F|2026-07-11|2||Pie De Metro Digital Fibra De Carbono LCD 0-150mm
142|F|2026-07-11|10|1890|Set 30 Destornilladores De Precisión Celulares Y Otros
143|F|2026-07-11|10|1320|Cepillo Limpieza Cadena Transmisión Motos Y Bicicletas
145|F|2026-07-11|4|1890|Máscara Facial Térmica Neopreno Con Cuello Polar (negra y roja)
147|F|2026-07-11|10||Luces LED Recargables Para Bicicleta Blanco
148|F|2026-07-11|5||Cable Extensión Alargador Audífonos 3 Metros
149|D|2026-07-11|1|4690|Pack 4 Soportes De Pared Para Guitarra
151|F|2026-07-09|10|3020|Auriculares Gamer Inalámbricos P47 5.0+EDR Blanco
154|F|2026-07-08|1|42320|Gabinete Newgen Titanium 01 Mesh ATX 4 Fans ARGB Negro
159|D|2026-06-03|1|4990|Huesitos Con Pollo Para Perros
160|D|2026-06-03|1|4945|Shampoo Topk9 Coco Y Biotina 500ml
161|D|2026-06-03|1||Lima De Uñas Eléctrica Perro Gato
162|D|2026-06-03|1|3191|Hueso De Juguete Comestible Para Perro
163|F|2026-06-02|10|1718|Splitter Adaptador Jack 3.5mm Audio Y Micrófono (de 1 a 2)
167|F|2026-06-02|3|3670|Mouse Inalámbrico Recargable Audeos Dual Bluetooth RGB 1600dpi Negro
172|F|2026-06-02|10|3196|Mouse Pad Gamer DGX Kill Pad Impresive 80x30 (azul y café)
175|F|2026-06-02|10|5515|Alargador Eléctrico 10 Mts 5 Bocas Con Interruptor Blanco
179|F|2026-05-25|10|8454|Pack X4 Lámpara Solar 100 LED Exterior Con Sensor De Movimiento
182|F|2026-05-15|4|4990|Pack X2 Candado De Bicicleta Cable Antirrobo
186|F|2026-05-15|2||Kit De Energía Solar Multiuso Ampolletas Linterna USB Radio
188|F|2026-05-15|2|7837|Linterna Lámpara Solar Power Bank Con Kit De Herramientas
190|F|2026-05-15|10|3063|Llave Tigre Multiuso Giro 360° 48 En 1
191|F|2026-05-15|18|3907|Calefactor Eléctrico Portátil 800w Handy Heater Con Control Remoto
193|F|2026-05-15|3|4068|Juego De Dardos Tablero Reversible
194|F|2026-05-15|10|3920|Kit De 3 Focos LED Inalámbricos Con Control Remoto
197|F|2026-05-15|5||Batidora Eléctrica De Mano Para Café Y Espuma De Leche
198|F|2026-05-15|5|1871|Lápiz Grabador Tallador Metal Vidrio Madera Cuero
199|F|2026-05-15|5|1356|Pizarra Mágica Niños 8,5 Pulgadas Con Plumón
200|F|2026-05-15|5||Tablero Mágico LCD De Notas Y Dibujo
201|F|2026-05-15|10|2390|Repisa Plegable Soporte Sobre Pantalla TV Y Monitor Negro
202|F|2026-05-15|4|9990|Calefactor Potop LQ-501 2000w Blanco
203|D|2026-05-08|1|1390|Trapero Húmedo Don Ahorrito 12 Unid
206|D|2026-05-08|1|10627|Barra De Ejercicios Flexiones Dominadas
207|F|2026-05-08|10|1984|Cable Extensión USB 2.0 Macho Hembra 3 Metros
211|D|2026-05-08|1|22867|Trapeador Mopa 360 Con Balde Centrífugo
214|F|2026-05-08|11|3742|Audífonos Inalámbricos TWS Bluetooth 5.0 F9 Con Pantalla LED Negro
216|F|2026-05-08|2|3215|Audífonos In-ear Inalámbricos Audio Pro AP02037 Negro
217|F|2026-05-08|3|39675|Gabinete Newgen Cobalt Glass mATX 3 Fans ARGB Blanco
224|F|2026-04-30|4|4590|Set Teclado Y Mouse Inalámbrico Weibo USB A Pilas Negro
226|F|2026-04-26|2||Reloj Despertador Termómetro Digital LCD Univex
227|F|2026-04-26|15||Mouse Pad Rectangular 18x22cm Negro
230|F|2026-04-26|5|1260|Cable Adaptador Audio P10 Macho A P2 Hembra 1.5m
231|F|2026-04-26|3||Cable HDMI 2.1 8K 60Hz 4K 120Hz Mohits 1.5m
237|F|2026-04-06|5|3057|Soporte Ajustable De Aluminio Plegable Para Notebook Hasta 15"
239|F|2026-04-06|2|76800|SSD Gigabyte G440E 500GB M.2 NVMe
245|F|2026-03-28|3|9300|Cargador Notebook Compatible HP 19.5v 2.31a Punta Azul
246|F|2026-03-28|2|1290|Cable AV Audio Video RCA 3x3 1m
248|F|2026-03-28|2|19980|Batería Compatible HP 740715-001 OA03 OA04
250|F|2026-03-28|5|2500|Linterna Minero De Cabeza Recargable 8 LED
251|F|2026-03-28|5|3025|Pistola Eléctrica De Silicona 20w 7mm + 10 Barras
254|F|2026-03-28|9|1500|Soporte De Celular Para Rejilla De Ventilación Del Auto
257|F|2026-03-28|2|32796|Batería Para HP HT03XL 240 245 250 255 G7 G8
264|F|2026-03-14|5||Adaptador USB-C 20W Para Lightning iPhone Carga Rápida
265|F|2026-03-14|2|10335|Cooler CPU Newgen Vortex White
267|F|2026-03-13|6|12173|Audífonos Gamer Monster Games Loud 550 Con Micrófono (negro, rojo, celeste)
270|F|2026-03-10|3|6190|Alargador Zapatilla Macrotel 5m Con Interruptor Negro
271|D|2026-03-10|1||Cuchillo Chef 8" Valkan
272|D|2026-03-10|1||Cargador Genérico HP 90w 19.5v 4.62a Punta Azul
273|D|2026-03-10|1|12990|Juego De Cubiertos Tramontina 24 Piezas
275|D|2026-03-10|1|8990|12 Paños De Cocina
276|D|2026-03-10|1||Pack 100 Bolsas Courier Autoadhesivas 30x42cm
277|D|2026-03-10|1||Headset Gamer Monster Throb (open box)
278|D|2026-03-10|1||Colador Cuiner Acero Inoxidable 28cm
279|D|2026-03-10|1||Set De 6 Vasos De Vidrio Chicago Allegra
280|D|2026-03-10|1||Set 12 Utensilios De Cocina De Silicona
281|D|2026-03-10|1|15400|Tabla De Madera Acacia 40 Cm
283|D|2026-03-10|1|13889|Kit Embalaje 6 Cintas Adhesivas + Film 250 m
284|D|2026-02-27|1|19990|Multivitamínico Multi Men 180 Cápsulas
285|D|2026-02-27|1|31994|Creatina 1 Kilo Dragon Pharma
287|F|2026-02-27|2|37553|Gabinete Gamer Aigo A275 mATX 3 Fans ARGB Negro
288|F|2026-02-27|1|34930|Gabinete Darkflash A290 Mesh ATX Vidrio Templado
289|F|2026-02-27|2|49990|Gabinete Gamer Alseye Cube + 7 Ventiladores Neo Pro Negro
291|F|2026-02-17|2||Aplique Solar LED Con Sensor De Movimiento 77 LED Blanco
293|F|2026-02-17|2|7318|Lona Repuesto Toldo Plegable 3x3 m Azul
294|F|2026-02-17|5|5990|Tester Multímetro Digital DT-9205A
295|F|2026-02-17|2|11970|Foco Solar 500w Con Panel Solar Y Control Remoto IP67
296|F|2026-02-17|2||Guirnalda 20 Ampolletas LED Luz Cálida 10 Metros
297|D|2026-02-17|1|10352|Tendedero Secador De Ropa Plegable Topy
299|F|2026-02-17|3||Foco Proyector LED 100w Osmao IP66 Exterior
300|F|2026-02-17|3||Lámpara De Emergencia LED Recargable 60 LED 24 Horas
301|D|2026-02-17|1||Escáner De Códigos De Barras USB Osmao
302|F|2026-02-17|3||Luminaria De Emergencia LED 60 Osmao L003 8h
303|F|2026-02-17|3||Lámpara De Emergencia Foco Solar Recargable Camping Naranja
305|F|2026-02-11|5||Pizarra De Corcho 50x70 Con Marco De Madera
307|F|2026-02-11|5|8132|Lona Repuesto Toldo Plegable 2x2 m Azul
309|F|2026-02-11|5||Pizarra De Corcho 30x40 Con Marco De Madera
310|F|2026-02-11|5|2714|Barra Luz LED Recargable USB 32 Cm
311|D|2026-01-31|1|3810|Guantes De Nitrilo Caja 100 Unidades
312|F|2026-01-31|2|22015|Cooler CPU Newgen Twin Vortex White ARGB
315|D|2026-01-22|3|6433|Sillas De Camping Plegables (roja, verde, azul)
318|F|2026-01-22|4||Dispensador De Agua Eléctrico Portátil USB Recargable
320|D|2026-01-22|1|13998|Luz De Escenario LED Par 36 RGB
322|F|2026-01-22|4|5032|Lámpara Solar Recargable 32 LED Emergencia 3600mAh
325|D|2026-01-17|1|3510|Cable Adaptador Mini DisplayPort A VGA
326|D|2026-01-17|1|2349|Cable Adaptador DisplayPort Macho A HDMI Hembra
328|F|2026-01-17|2||Adaptador USB-C Macho A USB-A Hembra Norplat
330|D|2026-01-17|1||Detector De Voltaje Sin Contacto 90-1000V
331|D|2026-01-14|4|19450|Estantería Rack Metálico 180x90x40
333|D|2025-12-29|1||Secador Escurridor De Loza 2 Niveles
334|F|2025-12-29|1||Hub Adaptador USB-C 6 En 1 (HDMI, 2 USB 3.0, TF, SD, USB-C)
336|D|2025-12-29|1|4260|Kit 3 Puntas De Soldadura Cautín Baku
337|F|2025-12-29|3|3072|Hub Tipo C A 4 Puertos USB 3.0
338|F|2025-12-29|7|37766|Gabinete Darkflash DK151 ATX 3 Fans ARGB
339|F|2025-12-29|1|32999|Gabinete ATX Para Refrigeración Líquida Panel De Cristal Blanco
340|F|2025-12-29|1|44067|Gabinete Darkflash DK352 Mid Tower Blanco Vidrio Templado RGB
341|F|2025-12-29|1|51606|Gabinete Darkflash DB460M mATX 4 Fans RGB Blanco
342|F|2025-12-29|2|45430|Gabinete Darkflash DK351 ATX 4 Fans RGB
344|F|2025-12-29|5|1990|Cargador De Auto 3 USB 4.2A Carga Rápida 12-24V
345|D|2025-12-29|1||Pack 4 Paneles Plafón LED 18w Redondo
346|D|2025-12-29|1|19980|Kit 5 Plafones LED 24w Embutidos
347|F|2025-12-29|2||Pack 3 Cables De Red UTP Cat6e RJ45 10 Metros
348|F|2025-12-29|2|5490|Cable De Red UTP Cat6e RJ45 40 Metros
349|F|2025-12-29|2||Cable De Red UTP Cat6e RJ45 30 Metros
350|D|2025-12-29|1||Set 10 Marcadores Permanentes Negros
351|D|2025-12-29|1||Mascarillas KN95 X100
352|D|2025-12-29|1|7990|Pack 5 Soquetes E27 Con Interruptor Y Cable 5 m
353|D|2025-12-29|1||Pack 10 Paneles Plafón LED 12w Embutidos
354|F|2025-12-29|2|6790|Cable De Red UTP Cat6e RJ45 50 Metros
356|F|2025-12-18|5|1163|Aro De Luz LED Selfie Para Celular 3 Modos USB
358|D|2025-12-18|2|2999|Peluche Capibara 18cm
359|D|2025-12-18|4|3990|Llaveros Peluche Sanrio
360|F|2025-12-18|5||Teclado Gamer Membrana Monster Games Onset T1026 RGB Español
361|F|2025-12-18|5|1860|Adaptador De Enchufe Universal Europeo Americano
362|F|2025-12-18|2||Joystick Gamer Bluetooth Monster Games Negro
363|D|2025-12-18|1||Cubo Pirámide Magnética Moyu
364|D|2025-12-18|1|2840|Squishy De Gatito
365|D|2025-12-18|1||Cubo Rubik 3x3 Stickerless
366|D|2025-12-18|1||Squishy De Stitch Y Ángel
367|D|2025-12-18|3||Peluche Cappuccino Assassino 25 cm
369|D|2025-12-18|1||Peluche Kirby 16 cm
370|D|2025-12-18|1|1990|Juego De Cartas Uno Stitch
371|D|2025-12-18|2|1990|Squishy Galleta Oreo
372|F|2025-12-18|5|2590|Mouse Inalámbrico Aoas 2.4GHz Negro
373|F|2025-12-18|3|1480|Mini Micrófono De Solapa Lavalier 3.5mm
375|D|2025-12-16|5|15138|Estante Metálico 180x90x40 Eoland 5 Niveles
377|D|2025-12-16|1||Ptero 5 Niveles (perchero)
380|D|2025-12-16|1||Rollo De Estaño 63/37 100g 0.8mm
381|D|2025-12-16|1||Gomitas Para Controles PS4 (4 piezas)
385|D|2025-12-16|1||Grips Para Análogos PS4/PS5
386|D|2025-12-16|2||Cable Adaptador Molex A PCI 6 Pin
387|D|2025-12-16|1||Pack 2 Flux Para Soldar RMA-223
388|D|2025-12-16|1||Rollo De Estaño 60/40 50g 0.3mm
389|D|2025-12-16|2|1325|Cable De Alimentación PCI-e 8 A Dual 4 Pin
390|D|2025-12-16|1||4 Gomas Grips Para Análogos
391|F|2025-12-16|7||Cable De Carga Rápida USB A Lightning Mgcalig Blanco
392|D|2025-12-16|1||Kit 5 Puntas De Soldadura Cautín
393|F|2025-12-16|2||Adaptador De Audio Plug 3.5mm Macho A 6.5mm Macho
395|F|2025-11-28|5|6885|Base Cooler Para Notebook Gamer N99 Negro
396|F|2025-11-28|10|3969|Ventilador Alzador De Notebook USB N191 Negro
397|D|2025-11-28|1|3990|Pegamento T-7000 50ml Para Pantallas
398|D|2025-11-23|1|34990|Proteína Whey Grizzly Bear
399|F|2025-11-21|5||Splitter De Audio 3.5mm Micrófono Y Audífono Para PS4
402|F|2025-11-21|5|1507|Copla HDMI Hembra Hembra Extensor
403|F|2025-11-21|5|1492|Adaptador OTG USB Tipo C Hembra A USB Macho Negro
404|F|2025-11-21|5||Parlante Para PC Notebook Estéreo USB Plug 3.5mm Tecnomati Negro
407|F|2025-11-20|40|3598|Mini Ventilador De Aire Frío Humidificador De Escritorio
412|F|2025-11-20|20|1599|Cable Mini USB 5 Pin 1.5m Negro
414|D|2025-11-20|1|11320|Adaptador USB A SATA/IDE 2.5 3.5 DVD
416|F|2025-11-10|4||Adaptador DVI 24+1 Macho A HDMI Hembra 1080p
419|F|2025-11-10|3|3076|Mouse Gamer X8 Ergonómico RGB 6000 DPI Cable 1.8 m Negro
421|F|2025-11-10|3||Cargador Dual Para 2 Controles PS4 USB
423|F|2025-11-10|5|1980|Cable USB A-B Para Impresora 1.5 m Negro
"""

# Grupos que junté por ser el mismo producto (unidades sumadas, costo promedio ponderado ya calculado arriba):
#   4 + 234 Soplador Mohits (7u: 5 a $8.200 y 2 a $9.036)  → se ajusta abajo
#   83 + 233 + 417 Cable trébol (65u)                       → se ajusta abajo
#   163 + 229, 145 + 146, 172 + 173, 214 + 215, 254 + 374, 267 + 357 + 368, 407 + 409 + 410, 416 + 418, 315-317
AJUSTE = {
    4: dict(u=7, costo=round((5 * 8200 + 2 * 9036) / 7), compras='10-10-2026 y 06-04-2026'),
    83: dict(u=65, costo=round((30 * 1370 + 20 * 1370 + 15 * 1790) / 65), compras='03-08-2026, 06-04-2026 y 10-11-2025'),
}

CAT = {  # categoría web / subcategoría, con la estructura que ya tiene la tienda
    'Herramientas': [4, 66, 123, 130, 131, 132, 133, 135, 136, 140, 142, 143, 190, 198, 251, 294],
    'Hogar y Estilo de Vida|Oficina y Embalaje': [3, 40, 200, 305, 309],
    'Hogar y Estilo de Vida|Limpieza y Cuidado': [31, 125],
    'Hogar y Estilo de Vida|Cocina y Camping': [38, 112, 197, 293, 307, 318],
    'Hogar y Estilo de Vida|Iluminación y Streaming': [99, 107, 108, 194, 296, 299, 300, 302, 310, 356],
    'Hogar y Estilo de Vida|Balanzas': [113],
    'Hogar y Estilo de Vida|Organización del Hogar': [120, 121, 124],
    'Hogar y Estilo de Vida|TV y Accesorios': [201],
    'Hogar y Estilo de Vida|Ventiladores': [407],
    'Hogar y Estilo de Vida': [80, 111, 126, 137, 138, 145, 147, 182, 191, 193, 199, 202, 226],
    'Energía Portátil|Pilas y Energía Solar': [34, 179, 186, 188, 250, 291, 295, 303, 322],
    'Cargadores': [62, 65, 68, 70, 245, 248, 257, 264],
    'Cables y Adaptadores|Cables de Poder': [63, 69, 83, 175, 270, 361],
    'Cables y Adaptadores|Cables USB y de Carga': [27, 75, 207, 391, 412, 423],
    'Cables y Adaptadores|Adaptadores y Cables de Video': [72, 78, 231, 246, 402, 416],
    'Cables y Adaptadores|Cables de Audio': [148, 163, 230, 393, 399],
    'Cables y Adaptadores|Adaptadores USB': [328, 334, 337, 403],
    'Cables y Adaptadores|Cables de Red': [347, 348, 349, 354],
    'Componentes PC|Gabinetes': [154, 217, 287, 288, 289, 338, 339, 340, 341, 342],
    'Componentes PC|Coolers y Disipadores': [265, 312],
    'Almacenamiento|SSD': [239],
    'Audio|Audífonos': [151, 214, 216, 267, 373],
    'Audio|Parlantes': [404],
    'Periféricos|Mouse': [167, 372, 419],
    'Periféricos|Combos Teclado y Mouse': [224],
    'Periféricos|Mandos y Joystick': [362, 421],
    'Periféricos|Otros Periféricos': [172, 227, 237, 360, 395, 396],
    'Accesorios Móviles|Accesorios para Auto': [254, 344],
}
cat_de = {}
for k, ids in CAT.items():
    for i in ids:
        assert i not in cat_de, i
        cat_de[i] = k

NOTAS = {
    3: 'Una sola: ¿es para vender o es tuya?',
    34: '¿Es el borrador #357 "solar led light" del POS?',
    295: '¿Es el borrador #358 "solar flood light" del POS?',
    300: '¿Es el borrador #353 "emergency light" del POS?',
    250: '¿Es el borrador #356 "linterna cabeza" del POS?',
    70: 'Revisa si es el mismo que el #222 (Cargador Universal Notebook 120W)',
    347: 'Revisa si es el mismo que el #179 (Cable de red 10 m)',
    154: 'En el POS está la blanca (#184); esta es la negra',
    239: 'Costo alto para un SSD de 500 GB: revisa si es el precio que pagaste',
    191: 'Lo compraste en mayo: revisa cuántos te quedan',
    40: 'Rollos adhesivos para la mini impresora gatito (#182)',
}

# Margen objetivo: la tabla aprobada el 03-10-2026 y, si la categoría no está, la mediana de sus
# productos (la misma regla de POST /api/productos/precio-sugerido).
MEDIANAS = {
    'Herramientas': 0.332, 'Cargadores': 0.570, 'Energía Portátil|Pilas y Energía Solar': 0.578,
    'Almacenamiento|SSD': 0.445, 'Audio|Audífonos': 0.397, 'Audio|Parlantes': 0.153,
    'Periféricos|Mouse': 0.476, 'Periféricos|Combos Teclado y Mouse': 0.317,
    'Periféricos|Mandos y Joystick': 0.371, 'Periféricos|Otros Periféricos': 0.38,
    'Accesorios Móviles|Accesorios para Auto': 0.681,
}
def margen(cat):
    c, _, s = cat.partition('|')
    if c == 'Componentes PC' and s == 'Gabinetes': return 0.22
    if c == 'Componentes PC': return 0.25
    if c == 'Cables y Adaptadores': return 0.45
    if c == 'Hogar y Estilo de Vida': return 0.40
    return max(0.15, min(MEDIANAS[cat], 0.70))

def en990(v):
    return max(990, math.ceil((max(0, v) - 990) / 1000) * 1000 + 990)

def precios(costo, cat):
    if not costo: return None
    m = margen(cat)
    p = en990(costo / (1 - m))
    piso = math.ceil(costo / 0.8)
    mb = (p - costo) / p
    rebaja = min(mb / 3, 0.20) * p
    c1 = max(round((p - rebaja) / 100) * 100, math.ceil(piso / 100) * 100)
    may1 = may2 = None
    if c1 <= p * 0.97:
        may1 = dict(precio=c1, desde=3 if p >= 8000 else (5 if p >= 3000 else 10))
        paso = 50 if c1 < 1000 else 100
        piso2 = math.ceil(max(piso, costo / 0.77) / paso) * paso
        c2 = max(round(c1 * 0.93 / paso) * paso, piso2)
        if c2 <= c1 * 0.97:
            may2 = dict(precio=c2, desde=min(1000, may1['desde'] * 2))
    return dict(precio=p, margen=round(m * 100), may1=may1, may2=may2)

items = []
for linea in RAW.strip().splitlines():
    i, t, dia, u, costo, titulo = linea.split('|')
    i = int(i); u = int(u); costo = int(costo) if costo else None
    a = AJUSTE.get(i, {})
    u = a.get('u', u); costo = a.get('costo', costo)
    cat = cat_de.get(i, '')
    if t == 'F': assert cat, (i, titulo)
    items.append(dict(
        id=f'g{i}', tipo=t, dia=dia, u=u, costo=costo, titulo=titulo,
        cat=cat.replace('|', ' › '), antes=dia < '2026-08-03', nota=NOTAS.get(i, ''),
        compras=a.get('compras', ''), sug=precios(costo, cat) if t == 'F' else None))

json.dump(items, open('items.json', 'w', encoding='utf-8'), ensure_ascii=False)
F = [x for x in items if x['tipo'] == 'F']; D = [x for x in items if x['tipo'] == 'D']
print('para vender', len(F), 'con costo', sum(1 for x in F if x['costo']), '| dudosos', len(D))
print('desde 03-08:', sum(1 for x in F if not x['antes']))
inv = sum((x['costo'] or 0) * x['u'] for x in F)
print('plata en lo para vender (a costo):', inv)
for x in F[:6]: print(x['titulo'][:40], x['costo'], x['sug'])
