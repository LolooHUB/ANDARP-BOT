const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('detencion')
        .setDescription('👮 Registrar la detención de un ciudadano (Solo Autoridades).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El ciudadano que ha sido detenido.')
                .setRequired(true)),

    async execute(interaction) {
        const ID_ROL_POLICIA = '1490138479567306864';
        
        // 🛡️ VERIFICAR AUTORIZACIÓN DEL MINISTERIO
        if (!interaction.member.roles.cache.has(ID_ROL_POLICIA)) {
            return interaction.reply({ 
                content: '❌ No tienes autorización del **Ministerio del Interior** para procesar detenciones.', 
                ephemeral: true 
            });
        }

        const target = interaction.options.getUser('usuario');

        // Verificar registro en la base de datos
        const userRef = db.collection('usuarios_rp').doc(target.id);
        const doc = await userRef.get();

        if (!doc.exists) {
            return interaction.reply({ 
                content: `❌ El ciudadano ${target} no figura en el Registro Civil. No se puede procesar a un sujeto sin identidad legal.`, 
                ephemeral: true 
            });
        }

        // --- MODAL DE DETENCIÓN ---
        const modal = new ModalBuilder()
            .setCustomId(`modal_detencion_${target.id}`)
            .setTitle(`👮 Acta de Detención: ${target.username}`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('det_motivo').setLabel("Motivo / Cargos Penales").setStyle(TextInputStyle.Paragraph).setPlaceholder("Ej: Robo a mano armada y resistencia.").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('det_lugar').setLabel("Lugar de la detención").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Puerto de Barcelona").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('det_fecha').setLabel("Fecha y Hora").setStyle(TextInputStyle.Short).setPlaceholder("DD/MM/AAAA - HH:MM").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('det_evidencia').setLabel("Evidencia (Link)").setStyle(TextInputStyle.Short).setPlaceholder("https://imgur.com/...").setRequired(false))
        );

        return await interaction.showModal(modal);
    },

    async handleDetencionInteractions(interaction) {
        if (!interaction.customId.startsWith('modal_detencion_')) return;

        const targetId = interaction.customId.split('_')[2];
        const { fields, guild, user } = interaction;
        
        const motivo = fields.getTextInputValue('det_motivo');
        const lugar = fields.getTextInputValue('det_lugar');
        const fecha = fields.getTextInputValue('det_fecha');
        const evidencia = fields.getTextInputValue('det_evidencia') || "No se adjuntó evidencia visual.";

        const ID_CANAL_DETENCIONES = '1490140813286703165';
        const userRef = db.collection('usuarios_rp').doc(targetId);

        try {
            const doc = await userRef.get();
            const data = doc.data();
            const targetUser = await interaction.client.users.fetch(targetId);

            // 1. REGISTRAR EN ANTECEDENTES (Firebase)
            const nuevoAntecedente = {
                tipo: "Detención / Arresto",
                motivo: motivo,
                agente: user.tag,
                fecha: fecha,
                lugar: lugar,
                evidencia: evidencia
            };

            await userRef.update({
                'historial_delictivo': [...(data.historial_delictivo || []), nuevoAntecedente]
            });

            // 2. ENVIAR REPORTE AL MINISTERIO
            const canalDetenciones = guild.channels.cache.get(ID_CANAL_DETENCIONES);
            const embedDetencion = new EmbedBuilder()
                .setAuthor({ name: 'MINISTERIO DEL INTERIOR - REGISTRO DE DETENCIONES', iconURL: 'https://i.imgur.com/8L8O7vU.png' })
                .setTitle(`🚨 Sujeto Procesado - Ref. #${Math.floor(Math.random() * 999999)}`)
                .setColor(0x2C3E50) // Color oscuro institucional
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Ciudadano', value: `${targetUser} (${data.nombre})`, inline: true },
                    { name: '🆔 DNI', value: `#${data.numero_dni}`, inline: true },
                    { name: '👮 Agente al mando', value: `${user}`, inline: true },
                    { name: '📍 Ubicación', value: lugar, inline: true },
                    { name: '📅 Fecha y Hora', value: fecha, inline: true },
                    { name: '📎 Evidencia Digital', value: evidencia },
                    { name: '⚖️ Cargos Penales', value: motivo }
                )
                .setFooter({ text: 'Ministerio del Interior - Anda RP Catalunya' })
                .setTimestamp();

            if (canalDetenciones) await canalDetenciones.send({ embeds: [embedDetencion] });

            // 3. RESPUESTA FINAL
            await interaction.reply({ 
                content: `✅ Detención procesada con éxito. El expediente de **${data.nombre}** ha sido actualizado en el Ministerio del Interior.`, 
                ephemeral: true 
            });

            try {
                await targetUser.send({ 
                    content: `🚨 **Notificación del Ministerio del Interior**\nHas sido procesado penalmente bajo los siguientes cargos: **${motivo}**.\nTu historial ha sido actualizado.` 
                });
            } catch (e) { /* DM Cerrado */ }

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error crítico al comunicar la detención al Ministerio.", ephemeral: true });
        }
    }
};