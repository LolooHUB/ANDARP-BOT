const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antecedentes')
        .setDescription('👮 Consultar el historial delictivo de un ciudadano (Solo Autoridades).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El ciudadano a consultar.')
                .setRequired(true)),

    async execute(interaction) {
        const ID_ROL_POLICIA = '1490138479567306864';
        
        // 🛡️ VERIFICAR AUTORIZACIÓN DEL MINISTERIO
        if (!interaction.member.roles.cache.has(ID_ROL_POLICIA)) {
            return interaction.reply({ 
                content: '❌ Acceso denegado: Se requiere autorización del **Ministerio del Interior**.', 
                ephemeral: true 
            });
        }

        const target = interaction.options.getUser('usuario');

        try {
            const userRef = db.collection('usuarios_rp').doc(target.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ 
                    content: `❌ El sujeto ${target} no figura en la base de datos del Registro Civil.`, 
                    ephemeral: true 
                });
            }

            const data = doc.data();
            const historial = data.historial_delictivo || [];

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'MINISTERIO DEL INTERIOR - ARCHIVO JUDICIAL', iconURL: 'https://i.imgur.com/8L8O7vU.png' })
                .setTitle(`Expediente de: ${data.nombre}`)
                .setDescription(`Consulta de antecedentes para el ciudadano con DNI: **#${data.numero_dni}**`)
                .setThumbnail(target.displayAvatarURL())
                .setColor(historial.length > 0 ? 0xC0392B : 0x27AE60)
                .setTimestamp();

            if (historial.length === 0) {
                embed.addFields({ name: '✅ Estado Civil', value: 'El ciudadano no presenta antecedentes penales ni administrativos a la fecha.' });
            } else {
                // Mapear los últimos 10 antecedentes para no saturar el embed
                const listaAntecedentes = historial.slice(-10).reverse().map((delito, index) => {
                    return `**${index + 1}. [${delito.tipo}]**\n> **Motivo:** ${delito.motivo}\n> **Fecha:** ${delito.fecha}\n> **Agente:** ${delito.agente}${delito.cuantia ? `\n> **Cuantía:** ${delito.cuantia}` : ''}${delito.evidencia && delito.evidencia.startsWith('http') ? `\n> **Evidencia:** [Ver](${delito.evidencia})` : ''}`;
                }).join('\n\n');

                embed.addFields({ name: '🚨 Registros Encontrados', value: listaAntecedentes });
            }

            embed.setFooter({ text: 'Información Confidencial - Uso exclusivo Policial' });

            // RESPUESTA EPHEMERAL (Solo la ve el policía)
            return interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al conectar con la base de datos del Ministerio.", ephemeral: true });
        }
    }
};