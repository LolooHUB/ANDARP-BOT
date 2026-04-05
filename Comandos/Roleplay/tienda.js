const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    AttachmentBuilder,
    ComponentType 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('🛒 Accede al catálogo oficial de suministros de la ciudad.'),

    async execute(interaction) {
        // --- CONFIGURACIÓN INICIAL ---
        const ID_CANAL_TIENDA = '1490436282873286717';
        const RUTA_LOGO = './attachments/LogoPFP.png';
        
        // 1. Restricción de Canal para evitar PowerGaming
        if (interaction.channelId !== ID_CANAL_TIENDA) {
            return interaction.reply({ 
                content: `❌ **Trámite Denegado:** Debes estar físicamente en la tienda oficial: <#${ID_CANAL_TIENDA}>.`, 
                ephemeral: true 
            });
        }

        // 2. Definición del Catálogo con Atributos de Peso
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

        try {
            const logo = new AttachmentBuilder(RUTA_LOGO);

            // 3. Construcción del Embed Principal
            const embedTienda = new EmbedBuilder()
                .setAuthor({ name: 'BAZAR CENTRAL - SISTEMA DE SUMINISTROS', iconURL: 'attachment://LogoPFP.png' })
                .setTitle('🛒 CATÁLOGO DE PRODUCTOS DISPONIBLES')
                .setColor('#f1c40f')
                .setThumbnail('attachment://LogoPFP.png')
                .setDescription(
                    'Bienvenido al mostrador. Elige los productos que necesites.\n' +
                    '*El cobro se realiza de forma automática desde tu cuenta bancaria.*\n\n' +
                    CATALOGO.map(i => `${i.emoji} **${i.label}**: \`${i.price.toLocaleString()}€\` | *${i.weight}kg*`).join('\n')
                )
                .addFields({ name: '⚠️ Aviso Legal', value: 'No se admiten devoluciones de productos abiertos o usados.' })
                .setFooter({ text: 'Generalitat de Catalunya - Registro de Comercio' });

            // 4. Creación del Menú de Selección
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

            // 5. Envío de la Interfaz
            return await interaction.reply({ 
                embeds: [embedTienda], 
                components: [filaAccion], 
                files: [logo] 
            });

        } catch (error) {
            console.error("Error en Tienda Execute:", error);
            return interaction.reply({ content: "❌ Error crítico al cargar el catálogo.", ephemeral: true });
        }
    },

    async handleTiendaInteractions(interaction) {
        if (!interaction.isStringSelectMenu() || interaction.customId !== 'comprar_tienda') return;

        const objetoId = interaction.values[0];
        const userId = interaction.user.id;

        // --- MAPEO DE DATOS TÉCNICOS ---
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
                return interaction.update({ content: "❌ No apareces en el Registro Civil (DNI no encontrado).", embeds: [], components: [] });
            }

            const data = doc.data();
            const saldoActual = data.banco || 0;
            const inventarioActual = data.inventario || {};
            
            // --- LÓGICA DE CAPACIDAD (MOCHILA) ---
            const tieneMochila = inventarioActual['mochila'] > 0;
            const capacidadMaxima = tieneMochila ? 35.0 : 20.0; // 20kg base, 35kg con mochila
            
            // Calcular peso actual del inventario
            let pesoTotalActual = 0;
            for (const [id, cantidad] of Object.entries(inventarioActual)) {
                if (ITEMS[id]) pesoTotalActual += (ITEMS[id].peso * cantidad);
            }

            // 1. Verificación de Saldo
            if (saldoActual < item.costo) {
                return interaction.update({ 
                    content: `❌ **${interaction.user.username}**, no tienes fondos suficientes.\nCoste: **${item.costo.toLocaleString()}€** | Saldo: **${saldoActual.toLocaleString()}€**`, 
                    embeds: [], components: [] 
                });
            }

            // 2. Verificación de Espacio
            if (pesoTotalActual + item.peso > capacidadMaxima) {
                return interaction.update({ 
                    content: `❌ **${interaction.user.username}**, no puedes cargar más peso.\nActual: **${pesoTotalActual.toFixed(2)}kg** / Límite: **${capacidadMaxima}kg**.\n*Sugerencia: Compra una mochila si no tienes una.*`, 
                    embeds: [], components: [] 
                });
            }

            // --- PROCESO DE COMPRA ---
            // Sumar cantidad al objeto de inventario
            inventarioActual[objetoId] = (inventarioActual[objetoId] || 0) + 1;

            await userRef.update({
                banco: saldoActual - item.costo,
                inventario: inventarioActual
            });

            // Registro en Consola para Auditoría
            console.log(`[SHOP] ${interaction.user.tag} compró ${item.nombre} por ${item.costo}€`);

            // Respuesta Final
            return interaction.update({ 
                content: `✅ **Compra Exitosa**\n**Producto:** ${item.nombre}\n**Precio:** ${item.costo.toLocaleString()}€\n**Comprador:** <@${userId}>\n\n*El objeto ha sido enviado a tu maletero personal / mochila.*`, 
                embeds: [], 
                components: [] 
            });

        } catch (error) {
            console.error("Error en Transacción de Tienda:", error);
            return interaction.update({ content: "❌ Error interno al procesar el pago. Contacta con un técnico.", embeds: [], components: [] });
        }
    }
};