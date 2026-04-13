/**
 * @file blackmarket.js
 * @description Sistema avanzado de Mercado Negro para Anda RP.
 * Incluye gestión de inventario, peso dinámico y sistema de alertas policiales.
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    AttachmentBuilder 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackmarket')
        .setDescription('💀 Acceso al mercado de contrabando de la ciudad.'),

    async execute(interaction) {
        // --- CONFIGURACIÓN DE ENTORNO ---
        const RUTA_LOGO = './attachments/LogoPFP.png';
        const COLOR_EMBED = '#1a1a1a';
        
        // --- CATÁLOGO DE CONTRABANDO ---
        // Se definen los objetos con propiedades de peso y descripción técnica para el usuario
        const ILEGALES = [
            { label: 'Glock-17', value: 'glock', price: 45000, emoji: '🔫', weight: 1.5, desc: 'Pistola 9mm semiautomática compacta.' },
            { label: 'AK-47 Kalashnikov', value: 'ak47', price: 180000, emoji: '⚔️', weight: 4.3, desc: 'Fusil de asalto de gran potencia.' },
            { label: 'Placa de Matrícula Virgen', value: 'placa_virgen', price: 12500, emoji: '🆔', weight: 0.5, desc: 'Indispensable para doblar matrículas.' },
            { label: 'Ganzúa Profesional', value: 'ganzua', price: 15000, emoji: '🔐', weight: 0.3, desc: 'Herramienta para forzar cerraduras.' },
            { label: 'Chaleco Antibalas Pesado', value: 'chaleco_pesado', price: 35000, emoji: '🛡️', weight: 8.0, desc: 'Protección de grado militar.' },
            { label: 'Inhibidor de Señal', value: 'inhibidor', price: 55000, emoji: '📵', weight: 2.0, desc: 'Anula GPS y radios en un radio corto.' },
            { label: 'Munición 9mm (x50)', value: 'muni_9mm', price: 5000, emoji: '📦', weight: 0.8, desc: 'Caja de munición para pistolas.' },
            { label: 'Munición 7.62 (x30)', value: 'muni_762', price: 12000, emoji: '🔥', weight: 1.2, desc: 'Caja de munición para fusiles.' }
        ];

        let logo = null;
        const files = [];

        // --- CARGA DE ASSETS VISUALES ---
        try {
            if (fs.existsSync(RUTA_LOGO)) {
                logo = new AttachmentBuilder(RUTA_LOGO);
                files.push(logo);
            } else {
                console.warn(`⚠️ Advertencia: Logo no encontrado en ${RUTA_LOGO}`);
            }
        } catch (error) {
            console.error("❌ Fallo crítico al cargar assets:", error);
        }

        // --- CONSTRUCCIÓN DE LA INTERFAZ ---
        try {
            const listaItems = ILEGALES.map(i => {
                return `${i.emoji} **${i.label}**: \`${i.price.toLocaleString()}€\` | *${i.weight}kg*`;
            }).join('\n');

            const embedMercado = new EmbedBuilder()
                .setAuthor({ 
                    name: 'RED DE CONTRABANDO - CONEXIÓN SEGURA', 
                    iconURL: logo ? 'attachment://LogoPFP.png' : null 
                })
                .setTitle('💀 SUMINISTROS DE MERCADO NEGRO')
                .setColor(COLOR_EMBED)
                .setThumbnail(logo ? 'attachment://LogoPFP.png' : null)
                .setDescription(
                    'Has ingresado a la red encriptada. No hagas preguntas, no des nombres.\n' +
                    'Si el dinero es real, la mercancía llegará a su destino.\n\n' +
                    listaItems +
                    '\n\n*Nota: Las transacciones son finales y no dejan rastro bancario físico.*'
                )
                .addFields({ 
                    name: '⚠️ ADVERTENCIA ESTATAL', 
                    value: 'La posesión de este equipo es penalizada con cadena perpetua por los Mossos.' 
                })
                .setFooter({ text: 'Sistema Clandestino v2.4 | Usa con discreción' })
                .setTimestamp();

            const menuClandestino = new StringSelectMenuBuilder()
                .setCustomId('comprar_blackmarket')
                .setPlaceholder('📦 Selecciona el pedido para procesar...')
                .addOptions(ILEGALES.map(i => ({
                    label: i.label,
                    description: `${i.desc} (Peso: ${i.weight}kg)`,
                    value: i.value,
                    emoji: i.emoji
                })));

            const fila = new ActionRowBuilder().addComponents(menuClandestino);

            return await interaction.reply({ 
                embeds: [embedMercado], 
                components: [fila], 
                files: files,
                ephemeral: true // Solo el usuario puede ver este menú por seguridad IC
            });

        } catch (error) {
            console.error("Error al ejecutar comando Blackmarket:", error);
            return await interaction.reply({ 
                content: "❌ El enlace con el mercado se ha roto. Inténtalo más tarde.", 
                ephemeral: true 
            });
        }
    },

    /**
     * @function handleBlackmarketInteractions
     * @description Maneja la compra y validaciones de Firebase.
     */
    async handleBlackmarketInteractions(interaction) {
        if (!interaction.isStringSelectMenu() || interaction.customId !== 'comprar_blackmarket') return;

        const objetoId = interaction.values[0];
        const userId = interaction.user.id;
        const canalNotificaciones = 'TU_ID_CANAL_AVISOS_PD'; // ID para el sistema de chivatos

        // --- MAPEO TÉCNICO DE DATOS (FIREBASE READ/WRITE) ---
        const ITEMS = {
            'glock': { nombre: 'Glock-17', costo: 45000, peso: 1.5, peligro: true },
            'ak47': { nombre: 'AK-47', costo: 180000, peso: 4.3, peligro: true },
            'placa_virgen': { nombre: 'Placa Virgen', costo: 12500, peso: 0.5, peligro: false },
            'ganzua': { nombre: 'Ganzúa Pro', costo: 15000, peso: 0.3, peligro: false },
            'chaleco_pesado': { nombre: 'Chaleco Pesado', costo: 35000, peso: 8.0, peligro: false },
            'inhibidor': { nombre: 'Inhibidor', costo: 55000, peso: 2.0, peligro: true },
            'muni_9mm': { nombre: 'Munición 9mm', costo: 5000, peso: 0.8, peligro: false },
            'muni_762': { nombre: 'Munición 7.62', costo: 12000, peso: 1.2, peligro: false },
            // Referencias cruzadas para cálculo de peso total
            'celular': { peso: 0.2 }, 'gps': { peso: 0.1 }, 'radio': { peso: 0.5 }, 
            'mochila': { peso: 0.0 }, 'kit_reparacion': { peso: 5.0 }, 
            'botiquin': { peso: 1.2 }, 'gasolina': { peso: 10.0 }, 'camara': { peso: 1.5 }
        };

        const item = ITEMS[objetoId];
        if (!item) return;

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            // --- VALIDACIÓN DE REGISTRO ---
            if (!doc.exists) {
                return interaction.update({ 
                    content: "💀 **ERROR:** No tienes una identidad registrada en la base de datos ciudadana.", 
                    embeds: [], components: [] 
                });
            }

            const data = doc.data();
            const saldoBancario = data.banco || 0;
            const invActual = data.inventario || {};

            // --- LÓGICA DE PESO Y CAPACIDAD ---
            const tieneMochila = (invActual['mochila'] || 0) > 0;
            const limitePeso = tieneMochila ? 35.0 : 20.0;
            
            let pesoCargaTotal = 0;
            for (const [id, cantidad] of Object.entries(invActual)) {
                const pesoUnitario = ITEMS[id] ? ITEMS[id].peso : 1.0;
                pesoCargaTotal += (pesoUnitario * cantidad);
            }

            // --- VALIDACIÓN 1: DINERO ---
            if (saldoBancario < item.costo) {
                const faltante = item.costo - saldoBancario;
                return interaction.update({ 
                    content: `💀 **NEGOCIO FALLIDO:** No tienes suficiente dinero. Faltan **${faltante.toLocaleString()}€**.`, 
                    embeds: [], components: [] 
                });
            }

            // --- VALIDACIÓN 2: ESPACIO EN INVENTARIO ---
            if (pesoCargaTotal + item.peso > limitePeso) {
                return interaction.update({ 
                    content: `💀 **CARGA EXCESIVA:** No puedes cargar con esto.\n📦 Peso actual: **${pesoCargaTotal.toFixed(2)}kg**\n⚖️ Límite: **${limitePeso}kg**.`, 
                    embeds: [], components: [] 
                });
            }

            // --- PROCESO DE ACTUALIZACIÓN (TRANSACCIÓN) ---
            invActual[objetoId] = (invActual[objetoId] || 0) + 1;

            await userRef.update({
                banco: saldoBancario - item.costo,
                inventario: invActual,
                ultima_transaccion: new Date().toISOString()
            });

            // --- SISTEMA DE ALERTA PROBABILÍSTICO ---
            let alertaTexto = "";
            const probabilidadChivato = Math.random();
            
            if (item.peligro && probabilidadChivato < 0.15) { // 15% de probabilidad
                alertaTexto = "\n\n*⚠️ Un informante anónimo te ha visto... has escuchado sirenas a lo lejos.*";
                const logCanal = interaction.guild.channels.cache.get(canalNotificaciones);
                
                if (logCanal) {
                    const alertaEmbed = new EmbedBuilder()
                        .setTitle('🚨 ALERTA DE MERCADO NEGRO')
                        .setColor('#FF0000')
                        .setDescription(`Se ha reportado actividad sospechosa. Un individuo ha adquirido **${item.nombre}**.`)
                        .setFooter({ text: 'Inteligencia Policial' })
                        .setTimestamp();
                    
                    logCanal.send({ embeds: [alertaEmbed] });
                }
            }

            // --- RESPUESTA EXITOSA ---
            return interaction.update({ 
                content: `💀 **TRANSACCIÓN COMPLETADA.**\nEl paquete de **${item.nombre}** ha sido entregado.\n\n` +
                         `*💰 Costo: ${item.costo.toLocaleString()}€*\n*⚖️ Peso del paquete: ${item.weight || item.peso}kg*${alertaTexto}`, 
                embeds: [], 
                components: [] 
            });

        } catch (error) {
            console.error("❌ Error crítico en transacción Blackmarket:", error);
            return interaction.update({ 
                content: "❌ **ERROR INTERNO:** La conexión con Firebase ha fallado.", 
                embeds: [], components: [] 
            });
        }
    }
};