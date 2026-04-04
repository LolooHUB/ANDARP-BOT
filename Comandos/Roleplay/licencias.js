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
        .setDescription('🚗 Ver o solicitar el carnet de conducir oficial.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Ver la licencia de otro ciudadano.')
                .setRequired(false)),

    async execute(interaction) {
        const ID_CANAL_PERMITIDO = '1490132182604316816';
        const ID_ROL_VERIFICADO = '1476791384894865419';

        if (interaction.channelId !== ID_CANAL_PERMITIDO) {
            return interaction.reply({ content: `❌ Trámite disponible únicamente en <#${ID_CANAL_PERMITIDO}>.`, ephemeral: true });
        }

        if (!interaction.member.roles.cache.has(ID_ROL_VERIFICADO)) {
            return interaction.reply({ content: '❌ Acceso denegado: Se requiere verificación.', ephemeral: true });
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

            if (data.licencias.conducir.estado) {
                const embedCarnet = new EmbedBuilder()
                    .setAuthor({ name: `SERVEI CATALÀ DE TRÀNSIT`, iconURL: interaction.guild.iconURL() })
                    .setTitle(`🪪 PERMÍS DE CONDUCCIÓ - CLASSE ${data.licencias.conducir.tipo}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setColor(0x00A1DE)
                    .addFields(
                        { name: '👤 Titular', value: data.nombre, inline: false },
                        { name: '🆔 DNI Asociado', value: `#${data.numero_dni}`, inline: true },
                        { name: '⭐ Punts', value: `${data.licencias.conducir.puntos} / 12`, inline: true },
                        { name: '📅 Expedició', value: data.licencias.conducir.fecha_exp || 'No data', inline: true },
                        { name: '⚠️ Estat', value: 'VIGENT / AUTORITZAT', inline: true }
                    )
                    .setFooter({ text: `Generalitat de Catalunya - Anda RP`, iconURL: target.displayAvatarURL() });

                return interaction.reply({ embeds: [embedCarnet] });
            }

            if (isSelf) {
                const modal = new ModalBuilder().setCustomId('modal_solicitar_licencia').setTitle('🚗 Sol·licitud de Permís');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_tipo').setLabel("Classe de Permís (A, B, C)").setStyle(TextInputStyle.Short).setPlaceholder("B = Turismes").setMaxLength(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_motivo').setLabel("Motiu de la sol·licitud").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lic_experiencia').setLabel("Anys d'experiència IC").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            } else {
                return interaction.reply({ content: `❌ El ciudadano **${target.username}** no dispone de licencia.`, ephemeral: true });
            }

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error en el servidor de Trànsit.", ephemeral: true });
        }
    },

    async handleLicenciaInteractions(interaction) {
        const { fields, user, guild } = interaction;
        const tipo = fields.getTextInputValue('lic_tipo').toUpperCase();
        const motivo = fields.getTextInputValue('lic_motivo');
        const exp = fields.getTextInputValue('lic_experiencia');
        const canalRevision = guild.channels.cache.get('1490132369175351397');

        const embedStaff = new EmbedBuilder()
            .setTitle("📄 Sol·licitud de Trànsit Pendenta")
            .setColor(0xF1C40F)
            .addFields(
                { name: '👤 Sol·licitant', value: `${user}`, inline: true },
                { name: '📇 Classe', value: tipo, inline: true },
                { name: '⏳ Experiència', value: exp, inline: true },
                { name: '📝 Justificació', value: motivo }
            )
            .setTimestamp();

        const botones = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprobar_lic_${user.id}_${tipo}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`denegar_lic_${user.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
        );

        if (canalRevision) await canalRevision.send({ content: '🚨 **Nova sol·licitud de trànsit**', embeds: [embedStaff], components: [botones] });
        return interaction.reply({ content: "✅ Sol·licitud enviada correctamente al Servei de Trànsit.", ephemeral: true });
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
            await interaction.update({ content: `✅ Permís **Classe ${clase}** aprovat per a <@${targetId}>.`, embeds: [], components: [] });
            try { await targetUser.send(`🚗 El teu permís de conducció **Classe ${clase}** ha estat aprovat! Consulta'l amb \`/licencia\`.`); } catch(e){}
        } else {
            await interaction.update({ content: `❌ Sol·licitud de <@${targetId}> denegada.`, embeds: [], components: [] });
            try { await targetUser.send("⚠️ La teva sol·licitud de permís de conducció ha estat rebutjada."); } catch(e){}
        }
    }
};