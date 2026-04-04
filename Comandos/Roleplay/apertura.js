const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    AttachmentBuilder 
} = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Gestiona la apertura, votación o cierre de la sesión de rol.'),

    async execute(interaction) {
        const docRef = db.collection('server_state').doc('current');
        const stateDoc = await docRef.get();
        
        // Si no existe el documento, asumimos que todo está cerrado
        const data = stateDoc.exists ? stateDoc.data() : { open: false, voting: false };
        const isOpen = data.open || false;
        const isVoting = data.voting || false;

        // --- CANCELACIÓN AUTOMÁTICA SI YA HAY VOTACIÓN ---
        if (isVoting) {
            await docRef.update({ voting: false, current_votes: 0, voters: [] });
            return interaction.reply({ 
                content: '🛑 **Votación cancelada.** El estado se ha reseteado. Usa `/apertura` de nuevo para configurar una nueva sesión.', 
                ephemeral: true 
            });
        }

        // --- APERTURA (Si está cerrado) ---
        if (!isOpen) {
            const modal = new ModalBuilder()
                .setCustomId('modal_setup_rol')
                .setTitle('⚙️ Configuración de Sesión');

            const horaInput = new TextInputBuilder()
                .setCustomId('hora_rol')
                .setLabel("⏰ Hora de inicio del rol")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Ej: 17:30h")
                .setRequired(true);

            const genteInput = new TextInputBuilder()
                .setCustomId('min_gente')
                .setLabel("👥 Mínimo de personas para abrir")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Ej: 12")
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(horaInput),
                new ActionRowBuilder().addComponents(genteInput)
            );

            return await interaction.showModal(modal);
        }

        // --- CIERRE (Si está abierto) ---
        if (isOpen) {
            const modalCierre = new ModalBuilder()
                .setCustomId('modal_resumen_cierre')
                .setTitle('🔴 Finalizar Sesión de Rol');

            const resumenInput = new TextInputBuilder()
                .setCustomId('resumen_final')
                .setLabel("📝 Resumen de la sesión")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Escribe qué tal fue el rol hoy...")
                .setRequired(true);

            modalCierre.addComponents(new ActionRowBuilder().addComponents(resumenInput));
            return await interaction.showModal(modalCierre);
        }
    },

    async handleAperturaInteractions(interaction) {
        const { customId, guild, user, fields } = interaction;
        const pingVotacion = "<@&1476765007344828590>"; 
        const canalSesiones = guild.channels.cache.get('1489830006979956787');
        const logBot = guild.channels.cache.get('1482565635715109015');
        const docRef = db.collection('server_state').doc('current');

        try {
            // Diferimos la respuesta para tener tiempo de procesar Firebase
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ ephemeral: true });
            }

            // 1️⃣ MODAL CONFIGURACIÓN
            if (customId === 'modal_setup_rol') {
                const hora = fields.getTextInputValue('hora_rol');
                const minGente = fields.getTextInputValue('min_gente');
                const fechaHora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

                await docRef.set({
                    open: false, voting: true, target_votes: parseInt(minGente),
                    current_votes: 0, voters: [], host: user.id, hora_inicio: hora
                });

                const embedVotacion = new EmbedBuilder()
                    .setAuthor({ name: "Anda RP - Rol de Calidad" })
                    .setTitle("📊 Votación De Rol")
                    .setDescription(`• Horario de Rol: **${hora}**\n\n• Votos Necesarios: **${minGente}**\n\n✅ Participar en la sesión.\n\n🟨 Asistiré, pero con retraso.\n\n❌ No podré asistir.`)
                    .setColor(16776960) 
                    .setImage('attachment://BannerVotacion.png')
                    .setFooter({ text: `Sistema de Rol de Anda RP - ${fechaHora}` });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('vote_yes').setLabel('Participar').setStyle(ButtonStyle.Success).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('vote_late').setLabel('Tarde').setStyle(ButtonStyle.Secondary).setEmoji('🟨'),
                    new ButtonBuilder().setCustomId('vote_no').setLabel('No asistir').setStyle(ButtonStyle.Danger).setEmoji('❌')
                );

                await canalSesiones.send({ 
                    content: pingVotacion, 
                    embeds: [embedVotacion], 
                    components: [row], 
                    files: ['./attachment/BannerVotacion.png'] 
                });
                
                return interaction.editReply({ content: "✅ Votación iniciada correctamente." });
            }

            // 2️⃣ PROCESAR VOTOS
            if (['vote_yes', 'vote_late', 'vote_no'].includes(customId)) {
                const stateDoc = await docRef.get();
                if (!stateDoc.exists || !stateDoc.data().voting) {
                    return interaction.editReply({ content: "❌ No hay una votación activa ahora mismo." });
                }

                const state = stateDoc.data();
                if (state.voters.includes(user.id)) {
                    return interaction.editReply({ content: "⚠️ Ya has votado en esta sesión." });
                }

                const newVoters = [...state.voters, user.id];
                
                if (customId === 'vote_yes') {
                    const newVotes = (state.current_votes || 0) + 1;
                    await docRef.update({ current_votes: newVotes, voters: newVoters });

                    if (newVotes >= state.target_votes) {
                        const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
                        const embedAbierto = new EmbedBuilder()
                            .setAuthor({ name: "Anda RP - Rol de Calidad" })
                            .setTitle("🟢 Servidor abierto")
                            .setDescription(`**El servidor se encuentra abierto!**\n\n👤 Los usuarios que votaron **DEBEN UNIRSE.**\n\n🔑 Código: **TwjxC**\n\n➕ **Host:** <@${state.host}>`)
                            .setColor(65280) 
                            .setImage('attachment://BannerVotacionSI.png')
                            .setFooter({ text: `Anda RP - ${fechaActual}` });

                        await docRef.update({ open: true, voting: false });
                        await canalSesiones.send({ content: pingVotacion, embeds: [embedAbierto], files: ['./attachment/BannerVotacionSI.png'] });
                        
                        const pings = newVoters.map(id => `<@${id}>`).join(' ');
                        await canalSesiones.send({ content: `🔔 **Aviso de apertura:** ${pings}` });
                    }
                } else {
                    await docRef.update({ voters: newVoters });
                }
                return interaction.editReply({ content: "✅ Voto registrado correctamente." });
            }

            // 3️⃣ PROCESAR CIERRE
            if (customId === 'modal_resumen_cierre') {
                const resumen = fields.getTextInputValue('resumen_final');
                const fechaCierre = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

                await docRef.set({ open: false, voting: false, current_votes: 0, voters: [] });
                
                await db.collection('logs_sesiones').add({
                    host: user.id, resumen, fecha: fechaCierre, tipo: "CIERRE"
                });

                const embedCierre = new EmbedBuilder()
                    .setTitle("🔴 Servidor cerrado")
                    .setDescription(`La sesión ha finalizado. Gracias por participar.`)
                    .setColor(16711680) 
                    .setImage('attachment://BannerCierre.png');

                await canalSesiones.send({ content: pingVotacion, embeds: [embedCierre], files: ['./attachment/BannerCierre.png'] });
                await logBot.send({ content: `🛑 **Sesión Finalizada** por <@${user.id}>` });

                return interaction.editReply({ content: "✅ Sesión cerrada y registrada." });
            }
        } catch (e) {
            console.error(e);
            if (interaction.deferred) await interaction.editReply({ content: "Hubo un error interno." });
        }
    }
};