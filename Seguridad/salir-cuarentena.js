const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    Events
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('salir-cuarentena')
        .setDescription('Inicia el formulario para solicitar la salida de cuarentena.'),

    async execute(interaction) {
        const rolCuarentenaId = '1492342183813189783';
        
        // Verificar si el usuario está realmente en cuarentena
        if (!interaction.member.roles.cache.has(rolCuarentenaId)) {
            return interaction.reply({ 
                content: '❌ No te encuentras en estado de cuarentena.', 
                ephemeral: true 
            });
        }

        // Crear el Modal (Formulario)
        const modal = new ModalBuilder()
            .setCustomId(`modal_cuarentena_${interaction.user.id}`)
            .setTitle('Solicitud de Salida de Cuarentena');

        const q1 = new TextInputBuilder()
            .setCustomId('motivo_ingreso')
            .setLabel('¿Por qué crees que entraste en cuarentena?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Ej: Estaba sancionando a varios trolls muy rápido...')
            .setRequired(true);

        const q2 = new TextInputBuilder()
            .setCustomId('explicacion')
            .setLabel('Explica detalladamente lo sucedido')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(q1),
            new ActionRowBuilder().addComponents(q2)
        );

        await interaction.showModal(modal);
    }
};

