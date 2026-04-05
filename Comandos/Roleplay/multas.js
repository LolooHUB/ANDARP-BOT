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
        .setName('multar')
        .setDescription('👮 Sancionar a un ciudadano (Solo Autoridades).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El ciudadano que recibirá la multa.')
                .setRequired(true)),

    async execute(interaction) {
        const ID_ROL_POLICIA = '1490138479567306864';
        
        // 🛡️ VERIFICAR AUTORIZACIÓN DEL MINISTERIO
        if (!interaction.member.roles.cache.has(ID_ROL_POLICIA)) {
            return interaction.reply({ 
                content: '❌ No tienes autorización del **Ministerio del Interior** para emitir sanciones.', 
                ephemeral: true 
            });
        }

        const target = interaction.options.getUser('usuario');

        // Verificar registro en la base de datos
        const userRef = db.collection('usuarios_rp').doc(target.id);
        const doc = await userRef.get();

        if (!doc.exists) {
            return interaction.reply({ 
                content: `❌ El ciudadano ${target} no figura en el Registro Civil. No se puede sancionar a alguien sin DNI.`, 
                ephemeral: true 
            });
        }

        // --- MODAL DE SANCIÓN ---
        const modal = new ModalBuilder()
            .setCustomId(`modal_multa_${target.id}`)
            .setTitle(`👮 Acta de Infracción: ${target.username}`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multa_motivo').setLabel("Motivo / Infracción").setStyle(TextInputStyle.Paragraph).setPlaceholder("Ej: Conducción temeraria.").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multa_lugar').setLabel("Lugar de los hechos").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Autopista C-32").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multa_fecha').setLabel("Fecha y Hora").setStyle(TextInputStyle.Short).setPlaceholder("DD/MM/AAAA - HH:MM").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multa_puntos').setLabel("Puntos a detraer (0 si no aplica)").setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multa_cuantia').setLabel("Cuantía de la sanción (€)").setStyle(TextInputStyle.Short).setPlaceholder("Ej: 500").setRequired(true))
        );

        return await interaction.showModal(modal);
    },

    async handleMultaInteractions(interaction) {
        if (!interaction.customId.startsWith('modal_multa_')) return;

        const targetId = interaction.customId.split('_')[2];
        const { fields, guild, user } = interaction;
        
        const motivo = fields.getTextInputValue('multa_motivo');
        const lugar = fields.getTextInputValue('multa_lugar');
        const fecha = fields.getTextInputValue('multa_fecha');
        const puntosARestar = parseInt(fields.getTextInputValue('multa_puntos')) || 0;
        const cuantia = fields.getTextInputValue('multa_cuantia');

        const ID_CANAL_LOGS_MULTAS = '1490139468903088358';
        const userRef = db.collection('usuarios_rp').doc(targetId);

        try {
            const doc = await userRef.get();
            const data = doc.data();
            const targetUser = await interaction.client.users.fetch(targetId);

            // 1. ACTUALIZAR FIREBASE (Ministerio del Interior)
            let nuevosPuntos = data.licencias.conducir.puntos - puntosARestar;
            if (nuevosPuntos < 0) nuevosPuntos = 0;

            const nuevaInfraccion = {
                tipo: "Sanción Administrativa",
                motivo: motivo,
                agente: user.tag,
                fecha: fecha,
                cuantia: `${cuantia}€`,
                puntos_retirados: puntosARestar
            };

            await userRef.update({
                'licencias.conducir.puntos': nuevosPuntos,
                'historial_delictivo': [...(data.historial_delictivo || []), nuevaInfraccion]
            });

            // 2. ENVIAR REPORTE AL MINISTERIO
            const canalMultas = guild.channels.cache.get(ID_CANAL_LOGS_MULTAS);
            const embedMulta = new EmbedBuilder()
                .setAuthor({ name: 'MINISTERIO DEL INTERIOR - ACTA DE DENUNCIA', iconURL: 'https://i.imgur.com/8L8O7vU.png' })
                .setTitle(`📄 Sanción Registrada - Exp. #${Math.floor(Math.random() * 99999)}`)
                .setColor(0xE74C3C)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Infractor', value: `${targetUser} (${data.nombre})`, inline: true },
                    { name: '🆔 DNI', value: `#${data.numero_dni}`, inline: true },
                    { name: '👮 Agente emisor', value: `${user}`, inline: true },
                    { name: '📍 Ubicación', value: lugar, inline: true },
                    { name: '📅 Fecha/Hora', value: fecha, inline: true },
                    { name: '💰 Importe', value: `**${cuantia}€**`, inline: true },
                    { name: '📝 Infracción', value: motivo },
                    { name: '⭐ Impacto en Licencia', value: puntosARestar > 0 ? `Se han detraído **${puntosARestar} puntos**. Puntos actuales: **${nuevosPuntos}**.` : "Sin afectación de puntos." }
                )
                .setFooter({ text: 'Ministerio del Interior - Anda RP Catalunya' }) // Actualizado aquí
                .setTimestamp();

            if (canalMultas) await canalMultas.send({ embeds: [embedMulta] });

            // 3. RESPUESTA FINAL
            await interaction.reply({ 
                content: `✅ Sanción registrada correctamente para **${data.nombre}** ante el Ministerio del Interior.`, 
                ephemeral: true 
            });

            try {
                await targetUser.send({ 
                    content: `⚠️ Has recibido una sanción oficial del **Ministerio del Interior**. Revisa tu historial con \`/dni\`.\n**Infracción:** ${motivo}\n**Importe:** ${cuantia}€` 
                });
            } catch (e) { /* DM Cerrado */ }

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error crítico al comunicar la sanción al Ministerio.", ephemeral: true });
        }
    }
};