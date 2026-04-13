const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

const CANAL_LOGS_RETIRO = '1482565635715109015';
const adminHierarchy = ['1476767750625038336', '1476768019496829033', '1476768122915782676', '1476768405037125885', '1476768951034970253'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarn')
        .setDescription('🗑️ Retira un warn del sistema.')
        .addStringOption(opt => opt.setName('casoid').setDescription('ID del caso').setRequired(true))
        .addStringOption(opt => opt.setName('motivo').setDescription('Motivo de retirada').setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.some(role => adminHierarchy.includes(role.id))) {
            return interaction.reply({ content: '❌ Solo administradores.', ephemeral: true });
        }

        const casoIdInput = interaction.options.getString('casoid').toUpperCase();
        const motivoRemocion = interaction.options.getString('motivo');

        await interaction.deferReply({ ephemeral: true });

        const query = await db.collection('sanciones_warns').get();
        const docBorrar = query.docs.find(doc => doc.id.slice(-6).toUpperCase() === casoIdInput);

        if (!docBorrar) return interaction.editReply(`❌ No existe el caso #${casoIdInput}`);

        const dataWarn = docBorrar.data();
        await docBorrar.ref.delete();

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`🗑️ WARN RETIRADO - #${casoIdInput}`)
            .addFields(
                { name: '👤 USUARIO', value: `<@${dataWarn.usuarioId}>`, inline: true },
                { name: '👮 ADMIN', value: `${interaction.user}`, inline: true },
                { name: '📝 MOTIVO', value: motivoRemocion }
            ).setTimestamp();

        const canal = interaction.guild.channels.cache.get(CANAL_LOGS_RETIRO);
        if (canal) await canal.send({ embeds: [embed] });

        await interaction.editReply(`✅ Caso #${casoIdInput} eliminado.`);
    }
};