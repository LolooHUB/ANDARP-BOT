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
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('licencia')
        .setDescription('🚗 Ver o solicitar el carnet de conducir oficial.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Ver la licencia de otro ciudadano.')
                .setRequired(false)),

    async execute(interaction) {
        // --- 🛡️ NUEVO CANAL ESPECÍFICO PARA LICENCIAS ---
        const ID_CANAL_PERMITIDO = '1490132246022193264'; 
        const ID_ROL_VERIFICADO = '1476791384894865419';

        if (interaction.channelId !== ID_CANAL_PERMITIDO) {
            return interaction.reply({ 
                content: `❌ Este trámite solo puede realizarse en el canal de Tránsito: <#${ID_CANAL_PERMITIDO}>.`, 
                ephemeral: true 
            });
        }

        if (!interaction.member.roles.cache.has(ID_ROL_VERIFICADO)) {
            return interaction.reply({ content: '❌ Debes estar **Verificado** para acceder a este trámite.', ephemeral: true });
        }

        const target = interaction.options.getUser('usuario') || interaction.user;
        const isSelf = target.id === interaction.user.id;

        try {
            const userRef = db.collection('usuarios_rp').doc(target.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ content: "❌ No existe un perfil ciudadano asociado. Usa `/dni` primero.", ephemeral: true });
            }

            const data = doc.data();

            // --- MOSTRAR CARNET SI YA EXISTE ---
            if (data.licencias.conducir.estado) {
                const embedCarnet = new EmbedBuilder()
                    .setAuthor({ name: `SERVICIO CATALÁN DE TRÁNSITO`, iconURL: interaction.guild.iconURL() })
                    .setTitle(`🪪 PERMISO DE CONDUCCIÓN - CLASE ${data.licencias.conducir.tipo}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setColor(0x00A1DE)
                    .addFields(
                        { name: '👤 Titular', value: data.nombre, inline: false },
                        { name: '🆔 DNI Asociado', value: `#${data.numero_dni}`, inline: true },
                        { name: '⭐ Puntos', value: `${data.licencias.conducir.puntos} / 12`, inline: true },
                        { name: '📅 Expedición', value: data.licencias.conducir.fecha_exp || 'Sin datos', inline: true },
                        { name: '⚠️ Estado', value: 'VIGENTE / AUTORIZADO', inline: true }
                    )
                    .setFooter({ text: `Generalitat de Catalunya - Anda RP`, iconURL: target.displayAvatarURL() });

                return interaction.reply({ embeds: [embedCarnet] });
            }

            // --- SOLICITAR CARNET SI NO TIENE ---
            if (isSelf) {
                const modal = new ModalBuilder().setCustomId('modal_solicitar_licencia').setTitle('🚗 Solicitud de Permiso');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_tipo').setLabel("Clase de Permiso (A, B, C)").setStyle(TextInputStyle.Short).setPlaceholder("B = Turismos").setMaxLength(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_motivo').setLabel("Motivo de la solicitud").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_experiencia').setLabel("Años de experiencia IC").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            } else {
                return interaction.reply({ content: `❌ El ciudadano **${target.username}** no dispone de licencia.`, ephemeral: true });
            }

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error en el servidor de Tránsito.", ephemeral: true });
        }
    },

    async handleLicenciaInteractions(interaction) {
        const { fields, user, guild } = interaction;
        const tipo = fields.getTextInputValue('lic_tipo').toUpperCase();
        const motivo = fields.getTextInputValue('lic_motivo');
        const exp = fields.getTextInputValue('lic_experiencia');
        
        const canalRevision = guild.channels.cache.get('1490132369175351397');

        const embedStaff = new EmbedBuilder()
            .setTitle("📄 Solicitud de Tránsito Pendiente")
            .setColor(0xF1C40F)
            .addFields(
                { name: '👤 Solicitante', value: `${user}`, inline: true },
                { name: '📇 Clase', value: tipo, inline: true },
                { name: '⏳ Experiencia', value: exp, inline: true },
                { name: '📝 Justificación', value: motivo }
            )
            .setTimestamp();

        const botones = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprobar_lic_${user.id}_${tipo}`).setLabel('Aprobar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`denegar_lic_${user.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
        );

        if (canalRevision) await canalRevision.send({ content: '🚨 **Nueva solicitud de tránsito**', embeds: [embedStaff], components: [botones] });
        return interaction.reply({ content: "✅ Solicitud enviada correctamente al Servicio de Tránsito.", ephemeral: true });
    },

    async handleButtons(interaction) {
        const [accion, , targetId, clase] = interaction.customId.split('_');
        const docRef = db.collection('usuarios_rp').doc(targetId);
        const targetUser = await interaction.client.users.fetch(targetId);

        if (accion === 'aprobar') {
            await docRef.update({
                'licencias.conducir.estado': true,
                'licencias.conducir.tipo': clase,
                'licencias.conducir.fecha_exp': new Date().toLocaleDateString('es-ES'),
                'licencias.conducir.puntos': 12
            });
            await interaction.update({ content: `✅ Permiso **Clase ${clase}** aprobado para <@${targetId}>.`, embeds: [], components: [] });
            try { await targetUser.send(`🚗 ¡Tu permiso de conducción **Clase ${clase}** ha sido aprobado! Consúltalo con \`/licencia\`.`); } catch(e){}
        } else {
            await interaction.update({ content: `❌ Solicitud de <@${targetId}> denegada.`, embeds: [], components: [] });
            try { await targetUser.send("⚠️ Tu solicitud de permiso de conducción ha sido rechazada."); } catch(e){}
        }
    }
};