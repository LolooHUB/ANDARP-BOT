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
// Ruta ajustada para que funcione desde la carpeta Roleplay
// Hola jejejejuju
const { db } = require('../../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apertura')
        .setDescription('🚀 Gestiona la apertura, votación o cierre de la sesión de rol.'),

    async execute(interaction) {
        const docRef = db.collection('server_state').doc('current');
        const stateDoc = await docRef.get();
        const isOpen = stateDoc.exists ? stateDoc.data().open : false;
        const isVoting = stateDoc.exists ? stateDoc.data().voting : false;

        // --- PREVENCIÓN: Si ya hay una votación en curso ---
        if (isVoting) {
            return interaction.reply({ content: '⚠️ Ya hay una votación en curso. Espera a que termine.', ephemeral: true });
        }

        // --- LÓGICA DE APERTURA (Si está cerrado) ---
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

        // --- LÓGICA DE CIERRE (Si está abierto) ---
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
            // 1️⃣ PROCESAR MODAL DE CONFIGURACIÓN (CREAR VOTACIÓN)
            if (customId === 'modal_setup_rol') {
                const hora = fields.getTextInputValue('hora_rol');
                const minGente = fields.getTextInputValue('min_gente');
                const fechaHora = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

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

                await docRef.set({
                    open: false,
                    voting: true,
                    target_votes: parseInt(minGente),
                    current_votes: 0,
                    voters: [],
                    host: user.id,
                    hora_inicio: hora
                });

                await canalSesiones.send({ content: pingVotacion, embeds: [embedVotacion], components: [row], files: ['./attachment/BannerVotacion.png'] });
                return interaction.reply({ content: "✅ Votación iniciada correctamente.", ephemeral: true });
            }

            // 2️⃣ PROCESAR VOTOS (BOTONES)
            if (['vote_yes', 'vote_late', 'vote_no'].includes(customId)) {
                const stateDoc = await docRef.get();
                const state = stateDoc.data();
                
                if (!state || !state.voting) return interaction.reply({ content: "❌ No hay una votación activa.", ephemeral: true });
                if (state.voters.includes(user.id)) return interaction.reply({ content: "⚠️ Ya has votado en esta sesión.", ephemeral: true });

                const newVoters = [...state.voters, user.id];
                
                if (customId === 'vote_yes') {
                    const newVotes = state.current_votes + 1;
                    const fechaActual = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

                    await docRef.update({ current_votes: newVotes, voters: newVoters });

                    if (newVotes >= state.target_votes) {
                        const embedAbierto = new EmbedBuilder()
                            .setAuthor({ name: "Anda RP - Rol de Calidad" })
                            .setTitle("🟢 Servidor abierto")
                            .setDescription(`**El servidor se encuentra abierto!**\n\n👤 Los usuarios que participaron en la votación **DEBEN UNIRSE obligatoriamente.**\n\n🔑 Código del servidor: **TwjxC**\n\n➕ **Sesión Hosteada por:** <@${state.host}>`)
                            .setColor(65280) 
                            .setImage('attachment://BannerVotacionSI.png')
                            .setFooter({ text: `Sistema de Rol de Anda RP - ${fechaActual}` });

                        await docRef.update({ open: true, voting: false });
                        await canalSesiones.send({ content: pingVotacion, embeds: [embedAbierto], files: ['./attachment/BannerVotacionSI.png'] });
                        
                        const pings = newVoters.map(id => `<@${id}>`).join(' ');
                        await canalSesiones.send({ content: `🔔 **Aviso de apertura:** ${pings}` });
                    }
                } else {
                    // SI EL VOTO ES "NO" O "TARDE", REGISTRAMOS AL VOTANTE PERO NO SUMAMOS VOTO POSITIVO
                    await docRef.update({ voters: newVoters });
                }

                // IMPORTANTE: Responder SIEMPRE a la interacción
                return interaction.reply({ content: "✅ Voto registrado correctamente.", ephemeral: true });
            }

            // 3️⃣ PROCESAR CIERRE (MODAL DE RESUMEN)
            if (customId === 'modal_resumen_cierre') {
                const resumen = fields.getTextInputValue('resumen_final');
                const fechaCierre = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

                const embedCierre = new EmbedBuilder()
                    .setAuthor({ name: "Anda RP - Rol de Calidad" })
                    .setTitle("🔴 Servidor cerrado")
                    .setDescription(`**El servidor ha sido cerrado.**\n\n🔴 La sesión de rol ha finalizado.\n\n👤 Gracias a todos los que participaron.\n\n📌 Estén atentos a la próxima votación.`)
                    .setColor(16711680) 
                    .setImage('attachment://BannerCierre.png')
                    .setFooter({ text: `Sistema de Rol de Anda RP - ${fechaCierre}` });

                await docRef.set({ open: false, voting: false, current_votes: 0, voters: [] });
                
                await db.collection('logs_sesiones').add({
                    host: user.id,
                    resumen: resumen,
                    fecha: fechaCierre,
                    tipo: "CIERRE"
                });

                await canalSesiones.send({ content: pingVotacion, embeds: [embedCierre], files: ['./attachment/BannerCierre.png'] });
                await logBot.send({ content: `🛑 **Sesión Finalizada**\n**Host:** <@${user.id}>\n**Resumen:** ${resumen}\n**Fecha:** ${fechaCierre}` });

                return interaction.reply({ content: "✅ Sesión cerrada y registrada en logs.", ephemeral: true });
            }
        } catch (e) {
            console.error(e);
            if (!interaction.replied) interaction.reply({ content: "❌ Error interno.", ephemeral: true });
        }
    }
};