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

// Verificá que esta ruta sea la correcta. 
// Si el bot dice "Cannot find module", el problema es esta línea:
const { db } = require('../../Automatizaciones/firebase');

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

            if (isVoting) {
                await docRef.update({ voting: false, current_votes: 0, voters: [] });
                return interaction.reply({ 
                    content: '🛑 **Votación cancelada.** Estado reseteado. Usa `/apertura` de nuevo.', 
                    ephemeral: true 
                });
            }

            if (!isOpen) {
                const modal = new ModalBuilder().setCustomId('modal_setup_rol').setTitle('⚙️ Configuración de Sesión');
                const horaInput = new TextInputBuilder().setCustomId('hora_rol').setLabel("⏰ Hora de inicio").setStyle(TextInputStyle.Short).setRequired(true);
                const genteInput = new TextInputBuilder().setCustomId('min_gente').setLabel("👥 Mínimo de personas").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(horaInput), new ActionRowBuilder().addComponents(genteInput));
                return await interaction.showModal(modal);
            }

            if (isOpen) {
                const modalCierre = new ModalBuilder().setCustomId('modal_resumen_cierre').setTitle('🔴 Finalizar Sesión');
                const resumenInput = new TextInputBuilder().setCustomId('resumen_final').setLabel("📝 Resumen").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modalCierre.addComponents(new ActionRowBuilder().addComponents(resumenInput));
                return await interaction.showModal(modalCierre);
            }
        } catch (error) {
            console.error("❌ ERROR EN EXECUTE:", error);
            return interaction.reply({ content: "Hubo un error al conectar con Firebase.", ephemeral: true });
        }
    },

    async handleAperturaInteractions(interaction) {
        const { customId, guild, user, fields } = interaction;
        const canalSesiones = guild.channels.cache.get('1489830006979956787');
        const docRef = db.collection('server_state').doc('current');

        try {
            // Diferimos la respuesta para que no expire
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ ephemeral: true });
            }

            if (customId === 'modal_setup_rol') {
                const hora = fields.getTextInputValue('hora_rol');
                const minGente = fields.getTextInputValue('min_gente');

                await docRef.set({
                    open: false, voting: true, target_votes: parseInt(minGente),
                    current_votes: 0, voters: [], host: user.id, hora_inicio: hora
                });

                const embedVotacion = new EmbedBuilder()
                    .setTitle("📊 Votación De Rol")
                    .setDescription(`• Horario: **${hora}**\n• Mínimo: **${minGente}**`)
                    .setColor(16776960)
                    .setImage('attachment://BannerVotacion.png');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('vote_yes').setLabel('Participar').setStyle(ButtonStyle.Success).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('vote_late').setLabel('Tarde').setStyle(ButtonStyle.Secondary).setEmoji('🟨'),
                    new ButtonBuilder().setCustomId('vote_no').setLabel('No asistir').setStyle(ButtonStyle.Danger).setEmoji('❌')
                );

                await canalSesiones.send({ 
                    content: "<@&1476765007344828590>", 
                    embeds: [embedVotacion], 
                    components: [row], 
                    files: ['./attachment/BannerVotacion.png'] 
                });
                
                return interaction.editReply({ content: "✅ Votación iniciada." });
            }

            // (El resto del código de votos y cierre igual que antes...)
            // Solo asegúrate de que el bloque catch final imprima el error:

        } catch (e) {
            console.error("❌ ERROR CRÍTICO EN HANDLER:", e); // <--- ESTO TE DIRÁ EL ERROR REAL EN LA CONSOLA
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `Hubo un error interno: ${e.message}` });
            }
        }
    }
};