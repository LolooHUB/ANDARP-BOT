const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Gestiona la apertura, votación o cierre de la sesión de rol.'),

    async execute(interaction) {
        try {
            const docRef = db.collection('server_state').doc('current');
            const stateDoc = await docRef.get();
            
            const data = stateDoc.exists ? stateDoc.data() : { open: false, voting: false };
            const isOpen = data.open || false;
            const isVoting = data.voting || false;

            // CANCELACIÓN: Si se usa el comando mientras hay votación, se resetea.
            if (isVoting) {
                await docRef.update({ voting: false, current_votes: 0, voters: [] });
                return interaction.reply({ 
                    content: '🛑 **Votación cancelada.** El estado se ha reseteado. Usa `/apertura` de nuevo para iniciar.', 
                    ephemeral: true 
                });
            }

            // MODO CONFIGURACIÓN (Si está cerrado)
            if (!isOpen) {
                const modal = new ModalBuilder().setCustomId('modal_setup_rol').setTitle('⚙️ Configuración de Sesión');
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('hora_rol').setLabel("⏰ Hora de inicio").setStyle(TextInputStyle.Short).setPlaceholder("Ej: 18:00h").setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('min_gente').setLabel("👥 Mínimo de personas").setStyle(TextInputStyle.Short).setPlaceholder("Ej: 10").setRequired(true)
                    )
                );
                return await interaction.showModal(modal);
            }

            // MODO CIERRE (Si está abierto)
            if (isOpen) {
                const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('🔴 Finalizar Sesión');
                modalCierre.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('resumen_final').setLabel("📝 Resumen").setStyle(TextInputStyle.Paragraph).setRequired(true)
                    )
                );
                return await interaction.showModal(modalCierre);
            }
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "❌ Error al conectar con la base de datos.", ephemeral: true });
        }
    },

    async handleAperturaInteractions(interaction) {
        const { customId, guild, user, fields } = interaction;
        const pingVotacion = "<@&1476765007344828590>"; 
        const canalSesiones = guild.channels.cache.get('1489830006979956787');
        const logBot = guild.channels.cache.get('1482565635715109015');
        const docRef = db.collection('server_state').doc('current');

        try {
            // Evitar timeout de interacción
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

            // 1️⃣ MODAL DE INICIO (Votación)
            if (customId === 'modal_setup_rol') {
                const hora = fields.getTextInputValue('hora_rol');
                const minGente = fields.getTextInputValue('min_gente');
                const fechaHora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

                await docRef.set({
                    open: false, voting: true, target_votes: parseInt(minGente),
                    current_votes: 0, voters: [], host: user.id, hora_inicio: hora
                });

                const embed = new EmbedBuilder()
                    .setAuthor({ name: "Anda RP - Rol de Calidad" })
                    .setTitle("📊 Votación De Rol")
                    .setDescription(`• Horario de Rol: **${hora}**\n\n• Votos Necesarios: **${minGente}**\n\n✅ Participar en la sesión.\n\n🟨 Asistiré, pero con retraso.\n\n❌ No podré asistir.`)
                    .setColor(16776960)
                    .setFooter({ text: `Anda RP - ${fechaHora}` });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('vote_yes').setLabel('Participar').setStyle(ButtonStyle.Success).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('vote_late').setLabel('Tarde').setStyle(ButtonStyle.Secondary).setEmoji('🟨'),
                    new ButtonBuilder().setCustomId('vote_no').setLabel('No asistir').setStyle(ButtonStyle.Danger).setEmoji('❌')
                );

                const payload = { content: pingVotacion, embeds: [embed], components: [row] };
                if (fs.existsSync('./attachment/BannerVotacion.png')) {
                    embed.setImage('attachment://BannerVotacion.png');
                    payload.files = ['./attachment/BannerVotacion.png'];
                }

                await canalSesiones.send(payload);
                return interaction.editReply({ content: "✅ Votación iniciada." });
            }

            // 2️⃣ BOTONES DE VOTO
            if (['vote_yes', 'vote_late', 'vote_no'].includes(customId)) {
                const stateDoc = await docRef.get();
                const state = stateDoc.data();

                if (!state || !state.voting) return interaction.editReply({ content: "❌ Votación inactiva." });
                if (state.voters.includes(user.id)) return interaction.editReply({ content: "⚠️ Ya votaste." });

                const newVoters = [...state.voters, user.id];
                if (customId === 'vote_yes') {
                    const newVotes = (state.current_votes || 0) + 1;
                    await docRef.update({ current_votes: newVotes, voters: newVoters });

                    if (newVotes >= state.target_votes) {
                        const embedAbierto = new EmbedBuilder()
                            .setTitle("🟢 Servidor abierto")
                            .setDescription(`🔑 Código: **TwjxC**\n👤 Host: <@${state.host}>`)
                            .setColor(65280);

                        const payloadOpen = { content: pingVotacion, embeds: [embedAbierto] };
                        if (fs.existsSync('./attachment/BannerVotacionSI.png')) {
                            embedAbierto.setImage('attachment://BannerVotacionSI.png');
                            payloadOpen.files = ['./attachment/BannerVotacionSI.png'];
                        }

                        await docRef.update({ open: true, voting: false });
                        await canalSesiones.send(payloadOpen);
                        const pings = newVoters.map(id => `<@${id}>`).join(' ');
                        await canalSesiones.send({ content: `🔔 **Aviso:** ${pings}` });
                    }
                } else {
                    await docRef.update({ voters: newVoters });
                }
                return interaction.editReply({ content: "✅ Voto registrado." });
            }

            // 3️⃣ MODAL DE CIERRE
            if (customId === 'modal_resumen_cierre') {
                const resumen = fields.getTextInputValue('resumen_final');
                const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

                await docRef.set({ open: false, voting: false, current_votes: 0, voters: [] });
                await db.collection('logs_sesiones').add({ host: user.id, resumen, fecha, tipo: "CIERRE" });

                const embedCierre = new EmbedBuilder().setTitle("🔴 Servidor cerrado").setColor(16711680);
                const payloadClose = { content: pingVotacion, embeds: [embedCierre] };

                if (fs.existsSync('./attachment/BannerCierre.png')) {
                    embedCierre.setImage('attachment://BannerCierre.png');
                    payloadClose.files = ['./attachment/BannerCierre.png'];
                }

                await canalSesiones.send(payloadClose);
                await logBot.send({ content: `🛑 **Sesión Finalizada**\n**Host:** <@${user.id}>\n**Resumen:** ${resumen}` });
                return interaction.editReply({ content: "✅ Sesión cerrada." });
            }
        } catch (e) {
            console.error("Error Crítico:", e);
        }
    }
};