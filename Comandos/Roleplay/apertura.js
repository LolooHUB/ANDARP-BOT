const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits 
} = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Sistema integral de gestión de sesiones (Votaciones por reacciones).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            const data = stateDoc.exists ? stateDoc.data() : { open: false, voting: false };

            // 1️⃣ CONFIRMACIÓN PARA CANCELAR VOTACIÓN
            if (data.voting) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_cancel_vote').setLabel('Confirmar Cancelación').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Mantener Votación').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ 
                    content: '⚠️ **¿Estás seguro de que quieres cancelar la votación actual?**', 
                    components: [row], 
                    ephemeral: true 
                });
            }

            // 2️⃣ CONFIRMACIÓN PARA CERRAR SESIÓN
            if (data.open) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_open_modal_cierre').setLabel('Sí, cerrar sesión').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('abort_action').setLabel('Mantener abierta').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ 
                    content: '🛑 **¿Deseas finalizar la sesión de rol actual?**', 
                    components: [row], 
                    ephemeral: true 
                });
            }

            // 3️⃣ INICIAR CONFIGURACIÓN (Si no hay nada activo)
            const modal = new ModalBuilder().setCustomId('modal_setup_rol').setTitle('Configurar Nueva Sesión');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hora_rol').setLabel("⏰ ¿A qué hora empieza el rol?").setStyle(TextInputStyle.Short).setPlaceholder("Ej: 22:30 ESP / 18:30 ARG").setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('min_gente').setLabel("👥 Mínimo de votos ✅ para abrir").setStyle(TextInputStyle.Short).setPlaceholder("Solo números (Ej: 12)").setMaxLength(2).setRequired(true))
            );
            return await interaction.showModal(modal);

        } catch (error) {
            console.error("Error en Execute Apertura:", error);
            if (!interaction.replied) interaction.reply({ content: "❌ Error al leer la base de datos.", ephemeral: true });
        }
    },

    async handleAperturaInteractions(interaction) {
        const { customId, fields, guild, user } = interaction;
        const canalSesiones = guild.channels.cache.get('1489830006979956787');
        const canalLogs = guild.channels.cache.get('1482565635715109015');
        const docRef = db.collection('server_state').doc('current');

        // --- MANEJO DE BOTONES DE SEGURIDAD ---
        if (customId === 'abort_action') {
            return interaction.update({ content: '✅ Acción cancelada. No se han realizado cambios.', components: [], ephemeral: true });
        }

        if (customId === 'confirm_cancel_vote') {
            await docRef.update({ voting: false, messageId: null, current_votes: 0 });
            return interaction.update({ content: '🛑 **Votación cancelada con éxito.**', components: [], ephemeral: true });
        }

        if (customId === 'confirm_open_modal_cierre') {
            const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('Finalizar Sesión Actual');
            modalCierre.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('resumen_final').setLabel("📝 Resumen de la sesión").setStyle(TextInputStyle.Paragraph).setRequired(true)));
            return await interaction.showModal(modalCierre);
        }

        // --- MANEJO DE MODALES ---
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

        try {
            if (customId === 'modal_setup_rol') {
                const hora = fields.getTextInputValue('hora_rol');
                const minGente = parseInt(fields.getTextInputValue('min_gente'));

                if (isNaN(minGente)) return interaction.editReply({ content: "❌ Error: Debe ser un número válido." });

                const embedVotacion = new EmbedBuilder()
                    .setAuthor({ name: "Anda RP | Gestión de Sesiones", iconURL: guild.iconURL() })
                    .setTitle("📊 Votación de Disponibilidad")
                    .setDescription(`Se ha propuesto una sesión de rol.\n\n**Información:**\n⏰ Hora: **${hora}**\n👥 Mínimo requerido: **${minGente} votos ✅**\n\n**¿Cómo votar?**\n✅ - Participaré\n🟨 - Entraré más tarde\n❌ - No puedo asistir`)
                    .setColor(0xF1C40F)
                    .setFooter({ text: "Sistema de Reacciones Activo" });

                const payload = { content: "<@&1476765007344828590>", embeds: [embedVotacion] };
                if (fs.existsSync('./attachment/BannerVotacion.png')) {
                    embedVotacion.setImage('attachment://BannerVotacion.png');
                    payload.files = ['./attachment/BannerVotacion.png'];
                }

                const msg = await canalSesiones.send(payload);
                await msg.react('✅'); await msg.react('🟨'); await msg.react('❌');

                await docRef.set({
                    open: false, voting: true, target_votes: minGente,
                    messageId: msg.id, host: user.id, hora_propuesta: hora
                });

                return interaction.editReply({ content: "✅ Votación lanzada con éxito." });
            }

            if (customId === 'modal_resumen_cierre') {
                const resumen = fields.getTextInputValue('resumen_final');
                const fechaCierre = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

                await docRef.set({ open: false, voting: false, messageId: null, current_votes: 0 });

                if (canalLogs) {
                    const embedLog = new EmbedBuilder()
                        .setTitle("🛑 Sesión Finalizada")
                        .addFields({ name: "👤 Host", value: `<@${user.id}>`, inline: true }, { name: "📅 Fecha", value: fechaCierre, inline: true }, { name: "📝 Resumen", value: resumen })
                        .setColor(0xE74C3C);
                    await canalLogs.send({ embeds: [embedLog] });
                }

                const embedPublico = new EmbedBuilder().setTitle("🔴 Servidor Cerrado").setColor(0xE74C3C).setTimestamp();
                const payloadCierre = { content: "<@&1476765007344828590>", embeds: [embedPublico] };
                if (fs.existsSync('./attachment/BannerCierre.png')) {
                    embedPublico.setImage('attachment://BannerCierre.png');
                    payloadCierre.files = ['./attachment/BannerCierre.png'];
                }

                await canalSesiones.send(payloadCierre);
                return interaction.editReply({ content: "✅ Sesión cerrada correctamente." });
            }
        } catch (e) { console.error(e); }
    },

    async handleReactions(reaction, user) {
        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            if (!stateDoc.exists) return;
            const state = stateDoc.data();

            if (!state.voting || reaction.message.id !== state.messageId || reaction.emoji.name !== '✅') return;

            const votosActuales = reaction.count - 1;

            if (votosActuales >= state.target_votes) {
                await docRef.update({ open: true, voting: false, messageId: null });

                const embedAbierto = new EmbedBuilder()
                    .setTitle("🟢 ¡Servidor Abierto!")
                    .setDescription(`Hemos alcanzado los **${state.target_votes}** votos necesarios.\n\n**Codigo Servidor:** TwjxC\n👤 Host: <@${state.host}>\n\n¡Los esperamos dentro!`)
                    .setColor(0x2ECC71);

                const payloadOpen = { content: "<@&1476765007344828590>", embeds: [embedAbierto] };
                if (fs.existsSync('./attachment/BannerVotacionSI.png')) {
                    embedAbierto.setImage('attachment://BannerVotacionSI.png');
                    payloadOpen.files = ['./attachment/BannerVotacionSI.png'];
                }

                await reaction.message.channel.send(payloadOpen);

                // --- 📩 AVISO POR DM ---
                const usuarios = await reaction.users.fetch();
                usuarios.forEach(async (u) => {
                    if (u.bot) return;
                    try {
                        const embedDM = new EmbedBuilder()
                            .setTitle("🚀 ¡El servidor ya está abierto!")
                            .setDescription(`¡Hola ${u.username}! Se ha alcanzado el mínimo de votos.\n\n**Codigo Servidor:** TwjxC\n¡Te esperamos!`)
                            .setColor(0x2ECC71);
                        await u.send({ embeds: [embedDM] });
                    } catch (e) { console.log(`DM bloqueado para ${u.tag}`); }
                });
            }
        } catch (error) { console.error(error); }
    }
};