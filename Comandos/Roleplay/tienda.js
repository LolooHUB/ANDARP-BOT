const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    AttachmentBuilder 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

/**
 * 🛒 MÓDULO DE TIENDA - ANDA RP
 * INTEGRACIÓN DE EMOJIS PERSONALIZADOS
 */

// --- 🎨 EMOJIS INTEGRADOS ---
const E_TIENDA = '<:Carrito:1493313258059333852>';
const E_EURO = '<:Euro:1493238471555289208>';
const E_TICK = '<:TickVerde:1493314122958245938>';
const E_ERROR = '<:Problema1:1493237859384164362>';
const E_BAN = '<:Ban:1493314179631681737>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('🛒 Accede al catálogo oficial de suministros de la ciudad.'),

    async execute(interaction) {
        // --- CONFIGURACIÓN INICIAL ---
        const ID_CANAL_TIENDA = '1490436282873286717';
        const RUTA_LOGO = './attachments/LogoPFP.png';
        
        // 1. Restricción de Canal
        if (interaction.channelId !== ID_CANAL_TIENDA) {
            return interaction.reply({ 
                content: `${E_ERROR} **Trámite Denegado:** Debes estar físicamente en la tienda oficial: <#${ID_CANAL_TIENDA}>.`, 
                ephemeral: true 
            });
        }

        const CATALOGO = [
            { label: 'Teléfono Móvil', value: 'celular', price: 1500, emoji: '📱', weight: 0.2, desc: 'Smartphone con servicios digitales.' },
            { label: 'GPS Navegación', value: 'gps', price: 800, emoji: '🗺️', weight: 0.1, desc: 'Mapa satelital de alta precisión.' },
            { label: 'Radio Frecuencia', value: 'radio', price: 1200, emoji: '📻', weight: 0.5, desc: 'Comunicación por canales de radio.' },
            { label: 'Mochila de Cuero', value: 'mochila', price: 3000, emoji: '🎒', weight: 0.0, desc: 'Expande tu capacidad de carga (+15kg).' },
            { label: 'Kit Reparación', value: 'kit_reparacion', price: 5000, emoji: '🛠️', weight: 5.0, desc: 'Herramientas para reparar el motor.' },
            { label: 'Botiquín Médico', value: 'botiquin', price: 1500, emoji: '🩹', weight: 1.2, desc: 'Curas rápidas para heridas leves.' },
            { label: 'Bidón Gasolina', value: 'gasolina', price: 850, emoji: '⛽', weight: 10.0, desc: 'Combustible de emergencia (10L).' },
            { label: 'Cámara Réflex', value: 'camara', price: 2500, emoji: '📷', weight: 1.5, desc: 'Para periodismo o recolección de pruebas.' }
        ];

        let logo = null;
        const files = [];

        // --- BYPASS DE IMAGEN ---
        try {
            if (fs.existsSync(RUTA_LOGO)) {
                logo = new AttachmentBuilder(RUTA_LOGO);
                files.push(logo);
            }
        } catch (e) {
            console.error("Error cargando logo tienda:", e);
        }

        try {
            const embedTienda = new EmbedBuilder()
                .setAuthor({ 
                    name: 'BAZAR CENTRAL - SISTEMA DE SUMINISTROS', 
                    iconURL: logo ? 'attachment://LogoPFP.png' : null 
                })
                .setTitle(`${E_TIENDA} CATÁLOGO DE PRODUCTOS DISPONIBLES`)
                .setColor('#f1c40f')
                .setThumbnail(logo ? 'attachment://LogoPFP.png' : null)
                .setDescription(
                    'Bienvenido al mostrador. Elige los productos que necesites.\n' +
                    `*El cobro se realiza automáticamente desde tu cuenta* ${E_EURO}\n\n` +
                    CATALOGO.map(i => `${i.emoji} **${i.label}**: \`${i.price.toLocaleString()}€\` ${E_EURO} | *${i.weight}kg*`).join('\n')
                )
                .addFields({ name: '⚠️ Aviso Legal', value: 'No se admiten devoluciones de productos abiertos o usados.' })
                .setFooter({ text: 'Generalitat de Catalunya - Registro de Comercio' });

            const menuSeleccion = new StringSelectMenuBuilder()
                .setCustomId('comprar_tienda')
                .setPlaceholder('Haz click aquí para elegir un producto...')
                .addOptions(CATALOGO.map(i => ({
                    label: i.label,
                    description: `${i.desc} (Peso: ${i.weight}kg)`,
                    value: i.value,
                    emoji: i.emoji
                })));

            const filaAccion = new ActionRowBuilder().addComponents(menuSeleccion);

            return await interaction.reply({ 
                embeds: [embedTienda], 
                components: [filaAccion], 
                files: files 
            });

        } catch (error) {
            console.error("Error en Tienda Execute:", error);
            return interaction.reply({ content: `${E_ERROR} Error crítico al cargar el catálogo.`, ephemeral: true });
        }
    },

    async handleTiendaInteractions(interaction) {
        if (!interaction.isStringSelectMenu() || interaction.customId !== 'comprar_tienda') return;

        const objetoId = interaction.values[0];
        const userId = interaction.user.id;

        const ITEMS = {
            'celular': { nombre: 'Teléfono Móvil', costo: 1500, peso: 0.2 },
            'gps': { nombre: 'GPS', costo: 800, peso: 0.1 },
            'radio': { nombre: 'Radio', costo: 1200, peso: 0.5 },
            'mochila': { nombre: 'Mochila', costo: 3000, peso: 0.0 },
            'kit_reparacion': { nombre: 'Kit de Reparación', costo: 5000, peso: 5.0 },
            'botiquin': { nombre: 'Botiquín', costo: 1500, peso: 1.2 },
            'gasolina': { nombre: 'Bidón de Gasolina', costo: 850, peso: 10.0 },
            'camara': { nombre: 'Cámara Réflex', costo: 2500, peso: 1.5 }
        };

        const item = ITEMS[objetoId];

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.update({ content: `${E_BAN} No apareces en el Registro Civil.`, embeds: [], components: [] });
            }

            const data = doc.data();
            const saldoActual = data.banco || 0;
            const inventarioActual = data.inventario || {};
            
            // Lógica de peso
            const tieneMochila = (inventarioActual['mochila'] || 0) > 0;
            const capacidadMaxima = tieneMochila ? 35.0 : 20.0;
            
            let pesoTotalActual = 0;
            for (const [id, cantidad] of Object.entries(inventarioActual)) {
                if (ITEMS[id]) {
                    pesoTotalActual += (ITEMS[id].peso * cantidad);
                }
            }

            if (saldoActual < item.costo) {
                return interaction.update({ 
                    content: `${E_BAN} **${interaction.user.username}**, no tienes fondos suficientes.\nCoste: **${item.costo.toLocaleString()}€** ${E_EURO} | Saldo: **${saldoActual.toLocaleString()}€**`, 
                    embeds: [], components: [] 
                });
            }

            if (pesoTotalActual + item.peso > capacidadMaxima) {
                return interaction.update({ 
                    content: `${E_ERROR} **${interaction.user.username}**, no puedes cargar más peso.\nActual: **${pesoTotalActual.toFixed(2)}kg** / Límite: **${capacidadMaxima}kg**.`, 
                    embeds: [], components: [] 
                });
            }

            // --- ACTUALIZACIÓN DE DATOS ---
            inventarioActual[objetoId] = (inventarioActual[objetoId] || 0) + 1;

            await userRef.update({
                banco: saldoActual - item.costo,
                inventario: inventarioActual
            });

            return interaction.update({ 
                content: `${E_TICK} **Compra Exitosa**\n**Producto:** ${item.nombre}\n**Precio:** ${item.costo.toLocaleString()}€ ${E_EURO}\n\n*El objeto ha sido enviado a tu inventario.*`, 
                embeds: [], 
                components: [] 
            });

        } catch (error) {
            console.error("Error en Transacción de Tienda:", error);
            return interaction.update({ content: `${E_ERROR} Error interno al procesar el pago.`, embeds: [], components: [] });
        }
    }
};