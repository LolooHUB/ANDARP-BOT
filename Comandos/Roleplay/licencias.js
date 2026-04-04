const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('licencia')
        .setDescription('🚗 Solicitar una licencia de conducción oficial.'),

    async execute(interaction) {
        const ID_CANAL_PERMITIDO = '1490132246022193264'; // Mismo canal que el DNI
        const ID_ROL_VERIFICADO = '1476791384894865419';

        // 🛡️ RESTRICCIONES
        if (interaction.channelId !== ID_CANAL_PERMITIDO) {
            return interaction.reply({ content: `❌ Solo puedes solicitar licencias en <#${ID_CANAL_PERMITIDO}>.`, ephemeral: true });
        }

        if (!interaction.member.roles.cache.has(ID_ROL_VERIFICADO)) {
            return interaction.reply({ content: '❌ Debes estar **Verificado** para solicitar una licencia.', ephemeral: true });
        }

        try {
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ content: "❌ Primero debes tramitar tu **DNI** con `/dni` antes de pedir una licencia.", ephemeral: true });
            }

            const data = doc.data();
            if (data.licencias.conducir.estado) {
                return interaction.reply({ content: `✅ Ya posees una licencia de tipo **${data.licencias.conducir.tipo}**. No es necesario solicitar otra.`, ephemeral: true });
            }

            // --- MODAL DE SOLICITUD ---
            const modal = new ModalBuilder().setCustomId('modal_solicitar_licencia').setTitle('🚗 Solicitud de Licencia de Manejo');

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_tipo').setLabel("Tipo de Licencia (A, B, C)").setStyle(TextInputStyle.Short).setPlaceholder("A (Motos), B (Coches), C (Pesados)").setMaxLength(1).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_motivo').setLabel("¿Para qué será usada?").setStyle(TextInputStyle.Paragraph).setPlaceholder("Ej: Trabajo de repartidor, uso personal, transporte de carga...").setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_experiencia').setLabel("Años de experiencia IC").setStyle(TextInputStyle.Short).setPlaceholder("Ej: 5 años").setRequired(true))
            );

            return await interaction.showModal(modal);

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al conectar con el servidor de licencias.", ephemeral: true });
        }
    },

    async handleLicenciaInteractions(interaction) {
        if (interaction.customId !== 'modal_solicitar_licencia') return;

        const { fields, user, guild } = interaction;
        const tipo = fields.getTextInputValue('lic_tipo').toUpperCase();
        const motivo = fields.getTextInputValue('lic_motivo');
        const exp = fields.getTextInputValue('lic_experiencia');
        
        const canalRevision = guild.channels.cache.get('1490132369175351397');

        // Embed para el Staff
        const embedStaff = new EmbedBuilder()
            .setTitle("📄 Nueva Solicitud de Licencia")
            .setColor(0xF1C40F)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '👤 Solicitante', value: `${user} (${user.id})`, inline: true },
                { name: '📇 Tipo Solicitado', value: `Clase **${tipo}**`, inline: true },
                { name: '⏳ Experiencia IC', value: exp, inline: true },
                { name: '📝 Motivo/Uso', value: motivo }
            )
            .setFooter({ text: "Usa los botones inferiores para decidir" })
            .setTimestamp();

        const botones = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprobar_lic_${user.id}_${tipo}`).setLabel('Aprobar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`denegar_lic_${user.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
        );

        if (canalRevision) {
            await canalRevision.send({ content: '🔔 **Nueva solicitud recibida**', embeds: [embedStaff], components: [botones] });
        }

        return interaction.reply({ content: "✅ Tu solicitud ha sido enviada al **Departamento de Motores y Vehículos**. Recibirás un mensaje si es aprobada.", ephemeral: true });
    },

    // Lógica para procesar la aprobación/denegación (Staff)
    async handleButtons(interaction) {
        const [accion, tipoDoc, targetId, clase] = interaction.customId.split('_');
        if (tipoDoc !== 'lic') return;

        const targetUser = await interaction.client.users.fetch(targetId);
        const docRef = db.collection('usuarios_rp').doc(targetId);

        if (accion === 'aprobar') {
            await docRef.update({
                'licencias.conducir.estado': true,
                'licencias.conducir.tipo': clase,
                'licencias.conducir.fecha_exp': new Date().toLocaleDateString('es-ES')
            });

            await interaction.update({ content: `✅ Licencia **Clase ${clase}** aprobada por ${interaction.user}.`, embeds: [], components: [] });
            try {
                await targetUser.send(`🎊 ¡Felicidades! Tu licencia de conducir **Clase ${clase}** ha sido aprobada en **Anda RP**.`);
            } catch (e) { console.log("DM cerrado"); }
        }

        if (accion === 'denegar') {
            await interaction.update({ content: `❌ Solicitud denegada por ${interaction.user}.`, embeds: [], components: [] });
            try {
                await targetUser.send(`⚠️ Lo sentimos, tu solicitud de licencia de conducir en **Anda RP** ha sido rechazada.`);
            } catch (e) { console.log("DM cerrado"); }
        }
    }
};