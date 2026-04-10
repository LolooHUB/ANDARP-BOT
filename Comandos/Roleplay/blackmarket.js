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
        
        // --- CATÁLOGO DE CONTRABANDO (SISTEMA DE PESO) ---
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

        // --- BYPASS SALVAJE DE IMAGEN ---
        try {
            if (fs.existsSync(RUTA_LOGO)) {
                logo = new AttachmentBuilder(RUTA_LOGO);
                files.push(logo);
            } else {
                console.warn(`⚠️ Advertencia: El archivo de logo no se encontró en ${RUTA_LOGO}.`);
            }
        } catch (error) {
            console.error("❌ Error al intentar cargar el logo:", error);
            logo = null;
        }

        try {
            const embedMercado = new EmbedBuilder()
                .setAuthor({ 
                    name: 'RED DE CONTRABANDO - TRÁFICO ILÍCITO', 
                    iconURL: logo ? 'attachment://LogoPFP.png' : null 
                })
                .setTitle('💀 SUMINISTROS DE MERCADO NEGRO')
                .setColor('#1a1a1a')
                .setThumbnail(logo ? 'attachment://LogoPFP.png' : null)
                .setDescription(
                    'No hagas preguntas, no des nombres. Si el dinero es real, la mercancía también.\n' +
                    '*Las transacciones son irreversibles y no dejan rastro bancario físico.*\n\n' +
                    ILEGALES.map(i => `${i.emoji} **${i.label}**: \`${i.price.toLocaleString()}€\` | *${i.weight}kg*`).join('\n')
                )
                .addFields({ name: '⚠️ Advertencia', value: 'Portar estos objetos es motivo de arresto inmediato por los Mossos.' })
                .setFooter({ text: 'Usa la mercancía con discreción.' });

            const menuClandestino = new StringSelectMenuBuilder()
                .setCustomId('comprar_blackmarket')
                .setPlaceholder('Selecciona tu pedido...')
                .addOptions(ILEGALES.map(i => ({
                    label: i.label,
                    description: `${i.desc} (${i.weight}kg)`,
                    value: i.value,
                    emoji: i.emoji
                })));

            const fila = new ActionRowBuilder().addComponents(menuClandestino);

            return await interaction.reply({ 
                embeds: [embedMercado], 
                components: [fila], 
                files: files 
            });

        } catch (error) {
            console.error("Error en Blackmarket Execute:", error);
            return await interaction.reply({ content: "❌ El contacto ha desaparecido (Error crítico).", ephemeral: true });
        }
    },

    async handleBlackmarketInteractions(interaction) {
        if (!interaction.isStringSelectMenu() || interaction.customId !== 'comprar_blackmarket') return;

        const objetoId = interaction.values[0];
        const userId = interaction.user.id;

        const ITEMS = {
            'glock': { nombre: 'Glock-17', costo: 45000, peso: 1.5, peligro: true },
            'ak47': { nombre: 'AK-47', costo: 180000, peso: 4.3, peligro: true },
            'placa_virgen': { nombre: 'Placa Virgen', costo: 12500, peso: 0.5, peligro: false },
            'ganzua': { nombre: 'Ganzúa Pro', costo: 15000, peso: 0.3, peligro: false },
            'chaleco_pesado': { nombre: 'Chaleco Pesado', costo: 35000, peso: 8.0, peligro: false },
            'inhibidor': { nombre: 'Inhibidor', costo: 55000, peso: 2.0, peligro: true },
            'muni_9mm': { nombre: 'Munición 9mm', costo: 5000, peso: 0.8, peligro: false },
            'muni_762': { nombre: 'Munición 7.62', costo: 12000, peso: 1.2, peligro: false },
            // Añadidos los de la tienda para que el cálculo de peso no falle si los tiene
            'celular': { peso: 0.2 }, 'gps': { peso: 0.1 }, 'radio': { peso: 0.5 }, 'mochila': { peso: 0.0 },
            'kit_reparacion': { peso: 5.0 }, 'botiquin': { peso: 1.2 }, 'gasolina': { peso: 10.0 }, 'camara': { peso: 1.5 }
        };

        const item = ITEMS[objetoId];

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.update({ content: "💀 No tienes papeles, lárgate de aquí.", embeds: [], components: [] });
            }

            const data = doc.data();
            const saldoBancario = data.banco || 0;
            const invActual = data.inventario || {};

            // --- CÁLCULO DE CAPACIDAD (Peso) ---
            const tieneMochila = (invActual['mochila'] || 0) > 0;
            const limitePeso = tieneMochila ? 35.0 : 20.0;
            
            let pesoCarga = 0;
            for (const [id, cant] of Object.entries(invActual)) {
                const pesoItem = ITEMS[id] ? ITEMS[id].peso : 1.0;
                pesoCarga += (pesoItem * cant);
            }

            // 1. Verificación de Dinero
            if (saldoBancario < item.costo) {
                return interaction.update({ 
                    content: `💀 **${interaction.user.username}**, no me hagas perder el tiempo. Te faltan **${(item.costo - saldoBancario).toLocaleString()}€**.`, 
                    embeds: [], components: [] 
                });
            }

            // 2. Verificación de Espacio
            if (pesoCarga + item.peso > limitePeso) {
                return interaction.update({ 
                    content: `💀 **${interaction.user.username}**, vas demasiado cargado. No puedes llevar la mercancía.\nCarga: **${pesoCarga.toFixed(2)}kg** / Límite: **${limitePeso}kg**.`, 
                    embeds: [], components: [] 
                });
            }

            // --- PROCESAMIENTO DE TRANSACCIÓN ---
            invActual[objetoId] = (invActual[objetoId] || 0) + 1;

            await userRef.update({
                banco: saldoBancario - item.costo,
                inventario: invActual
            });

            // 3. Sistema de "Chivatazo"
            let alertaTexto = "";
            if (item.peligro && Math.random() < 0.10) {
                alertaTexto = "\n*⚠️ Notas un movimiento extraño en las sombras... alguien podría haberte visto.*";
                const canalLogsPolicia = interaction.guild.channels.cache.get('TU_ID_CANAL_AVISOS_PD');
                if (canalLogsPolicia) canalLogsPolicia.send(`🚨 **AVISO ANÓNIMO:** Se informa de una transacción de armas en la zona.`);
            }

            return interaction.update({ 
                content: `💀 **Negocio Cerrado.**\nHas recogido tu **${item.nombre}**.\n\n*Recibo destruido. Se han descontado ${item.costo.toLocaleString()}€ de tu cuenta.*${alertaTexto}`, 
                embeds: [], 
                components: [] 
            });

        } catch (error) {
            console.error("Error en Blackmarket Interaction:", error);
            return interaction.update({ content: "❌ La red de contrabando se ha caído.", embeds: [], components: [] });
        }
    }
};