const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

/**
 * 👮 MÓDULO DE JUSTICIA Y SEGURIDAD - ANDA RP v2.5
 * ---------------------------------------------------------
 * SISTEMA DE PROCESAMIENTO PENAL ESTATAL
 * - Registro de Antecedentes en tiempo real.
 * - Notificación automática al Ministerio del Interior.
 * - Registro de Evidencia Digital.
 * ---------------------------------------------------------
 */

// --- 🎨 EMOJIS INTEGRADOS ---
const E_SIRENA = '🚨';
const E_POLI = '👮';
const E_BALANZA = '⚖️';
const E_DOC = '<:Aprobado1:1493237545486516224>';
const E_ALERTA = '<:Problema1:1493237859384164362>';
const E_BAN = '<:Ban:1493314179631681737>';
const E_TICK = '<:TickVerde:1493314122958245938>';
const E_INFO = 'ℹ️';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('detencion')
        .setDescription('👮 Registrar la detención de un ciudadano (Solo Autoridades).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El ciudadano que ha sido detenido.')
                .setRequired(true)),

    async execute(interaction) {
        // --- CONFIGURACIÓN DE CONSTANTES ---
        const ID_ROL_POLICIA = '1490138479567306864';
        const ID_CANAL_DETENCIONES = '1490140813286703165';
        
        console.log(`[POLICE SYSTEM] Intento de arresto por: ${interaction.user.tag}`);

        // 1. 🛡️ VERIFICACIÓN DE AUTORIZACIÓN (ROL DE POLICÍA)
        if (!interaction.member.roles.cache.has(ID_ROL_POLICIA)) {
            const errorPermiso = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`${E_BAN} ACCESO DENEGADO`)
                .setDescription('No posees las credenciales del **Ministerio del Interior** para procesar detenciones oficiales.')
                .setFooter({ text: 'Seguridad Nacional - Anda RP' });

            return interaction.reply({ embeds: [errorPermiso], ephemeral: true });
        }

        const target = interaction.options.getUser('usuario');

        // 2. 🔍 VERIFICAR SI EL SUJETO EXISTE EN EL REGISTRO CIVIL
        try {
            const userRef = db.collection('usuarios_rp').doc(target.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ 
                    content: `${E_ALERTA} **Sujeto no identificado:** El ciudadano ${target} no figura en el Registro Civil. Debe ser procesado primero como indocumentado.`, 
                    ephemeral: true 
                });
            }

            // --- 📝 CONSTRUCCIÓN DEL MODAL DE DETENCIÓN ---
            const modal = new ModalBuilder()
                .setCustomId(`modal_detencion_${target.id}`)
                .setTitle(`👮 ACTA DE DETENCIÓN: ${target.username}`);

            // Campos del Acta
            const cargos = new TextInputBuilder()
                .setCustomId('det_motivo')
                .setLabel("Cargos Penales / Motivo")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Ej: Homicidio en primer grado, posesión de armas ilícitas y fuga.")
                .setMinLength(10)
                .setMaxLength(1000)
                .setRequired(true);

            const lugar = new TextInputBuilder()
                .setCustomId('det_lugar')
                .setLabel("Lugar del Arresto")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Ej: Barrio Gótico, Barcelona")
                .setRequired(true);

            const fecha = new TextInputBuilder()
                .setCustomId('det_fecha')
                .setLabel("Fecha y Hora (IC)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("DD/MM/AAAA - HH:MM")
                .setRequired(true);

            const condena = new TextInputBuilder()
                .setCustomId('det_condena')
                .setLabel("Condena / Multa (Opcional)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Ej: 50 meses de prisión y 10.000€")
                .setRequired(false);

            const evidencia = new TextInputBuilder()
                .setCustomId('det_evidencia')
                .setLabel("Evidencia Fotográfica (Link)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("https://imgur.com/...")
                .setRequired(false);

            // Agregar filas al modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(cargos),
                new ActionRowBuilder().addComponents(lugar),
                new ActionRowBuilder().addComponents(fecha),
                new ActionRowBuilder().addComponents(condena),
                new ActionRowBuilder().addComponents(evidencia)
            );

            return await interaction.showModal(modal);

        } catch (error) {
            console.error("Error al consultar base de datos:", error);
            return interaction.reply({ content: "❌ Error al conectar con el servidor central.", ephemeral: true });
        }
    },

    // --- ⚙️ PROCESAMIENTO DE LA INFORMACIÓN DEL MODAL ---
    async handleDetencionInteractions(interaction) {
        if (!interaction.customId.startsWith('modal_detencion_')) return;

        const targetId = interaction.customId.split('_')[2];
        const { fields, guild, user } = interaction;
        
        // Extracción de datos
        const motivo = fields.getTextInputValue('det_motivo');
        const lugar = fields.getTextInputValue('det_lugar');
        const fecha = fields.getTextInputValue('det_fecha');
        const condena = fields.getTextInputValue('det_condena') || "Pendiente de juicio.";
        const evidencia = fields.getTextInputValue('det_evidencia') || "Sin evidencia adjunta.";

        const ID_CANAL_DETENCIONES = '1490140813286703165';
        const userRef = db.collection('usuarios_rp').doc(targetId);

        try {
            const doc = await userRef.get();
            const data = doc.data();
            const targetUser = await interaction.client.users.fetch(targetId);

            // 1. 📂 ACTUALIZAR EXPEDIENTE PENAL (FIREBASE)
            const registroArresto = {
                id_caso: `#${Math.floor(100000 + Math.random() * 900000)}`,
                tipo: "ARRESTO / PROCESAMIENTO",
                cargos: motivo,
                agente_responsable: user.tag,
                agente_id: user.id,
                fecha_ic: fecha,
                ubicacion: lugar,
                condena_impuesta: condena,
                evidencia: evidencia,
                timestamp: new Date()
            };

            await userRef.update({
                'historial_delictivo': [...(data.historial_delictivo || []), registroArresto],
                'estatus_legal': "Buscado / Procesado"
            });

            // 2. 🏛️ GENERAR REPORTE OFICIAL PARA EL MINISTERIO
            const canalJusticia = guild.channels.cache.get(ID_CANAL_DETENCIONES);
            
            const embedMinisterio = new EmbedBuilder()
                .setColor('#2C3E50') // Gris oscuro policial
                .setAuthor({ 
                    name: 'MINISTERIO DEL INTERIOR • DEPARTAMENTO DE JUSTICIA', 
                    iconURL: 'https://i.imgur.com/8L8O7vU.png' 
                })
                .setTitle(`${E_SIRENA} REPORTE DE DETENCIÓN Y PROCESAMIENTO`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(`**Estado del Expediente:** Actualizado ${E_TICK}\n**Referencia de Caso:** \`${registroArresto.id_caso}\``)
                .addFields(
                    { 
                        name: '👤 INFORMACIÓN DEL SUJETO', 
                        value: `> **Ciudadano:** ${targetUser}\n> **Nombre IC:** ${data.nombre}\n> **DNI:** \`${data.numero_dni}\``, 
                        inline: false 
                    },
                    { 
                        name: '👮 OFICIAL AL MANDO', 
                        value: `${user}\n**ID Policial:** \`${user.id.slice(-5)}\``, 
                        inline: true 
                    },
                    { 
                        name: '📍 JURISDICCIÓN', 
                        value: `${lugar}\n**Fecha:** ${fecha}`, 
                        inline: true 
                    },
                    { 
                        name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 
                        value: '⚖️ **DETALLES DEL PROCESAMIENTO PENAL**' 
                    },
                    { name: '📂 Cargos Criminales', value: `\`\`\`${motivo}\`\`\`` },
                    { name: '⛓️ Condena/Multa', value: condena, inline: true },
                    { name: '🖼️ Evidencia', value: `[Ver Adjunto](${evidencia})`, inline: true }
                )
                .setFooter({ text: 'Cuerpo de Policía de Catalunya - Anda RP', iconURL: guild.iconURL() })
                .setTimestamp();

            if (canalJusticia) await canalJusticia.send({ embeds: [embedMinisterio] });

            // 3. 🛡️ RESPUESTA AL AGENTE Y NOTIFICACIÓN AL REO
            await interaction.reply({ 
                content: `${E_TICK} **Sistema de Justicia:** La detención de **${data.nombre}** ha sido registrada correctamente en la base de datos nacional.`, 
                ephemeral: true 
            });

            // Intentar notificar por DM al usuario detenido
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`${E_SIRENA} NOTIFICACIÓN JUDICIAL`)
                    .setDescription(`Tu historial delictivo en **Anda RP** ha sido actualizado debido a una detención oficial.`)
                    .addFields(
                        { name: 'Cargos', value: motivo },
                        { name: 'Agente', value: user.username },
                        { name: 'Condena', value: condena }
                    )
                    .setFooter({ text: 'Este mensaje es una notificación oficial del sistema.' });

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmErr) {
                console.log(`No se pudo enviar DM a ${targetUser.tag} (Cerrados).`);
            }

        } catch (error) {
            console.error("❌ ERROR CRÍTICO EN PROCESAMIENTO PENAL:", error);
            return interaction.reply({ 
                content: `${E_ALERTA} Se produjo un error técnico. El registro no se guardó correctamente.`, 
                ephemeral: true 
            });
        }
    }
};

/**
 * 📊 ESTADÍSTICAS DEL CÓDIGO (POLICE EDITION):
 * -------------------------------------------
 * - Líneas de código: ~255
 * - Seguridad: Protección contra falsos oficiales y usuarios sin DNI.
 * - Registro: Integración total con Firebase y Canal de Logs.
 * - UX: Respuesta efímera para el oficial y DM para el detenido.
 * -------------------------------------------
 */