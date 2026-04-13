const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

/**
 * 👮 MÓDULO DE TRÁNSITO - ANDA RP
 */

// --- 🎨 EMOJIS INTEGRADOS ---
const E_POLICIA = '<:Aprobado1:1493237545486516224>';
const E_BAN = '<:Ban:1493314179631681737>';
const E_ALERTA = '<:Problema1:1493237859384164362>';
const E_AUTO = '<:AutoR:1493313156452454440>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('matricula')
        .setDescription('👮 Consultar titularidad de un vehículo (Solo Autoridades).')
        .addStringOption(option => 
            option.setName('numero')
                .setDescription('El número de matrícula (Ej: 1234-BBB)')
                .setRequired(true)),

    async execute(interaction) {
        const ID_ROL_POLICIA = '1490138479567306864';
        
        if (!interaction.member.roles.cache.has(ID_ROL_POLICIA)) {
            return interaction.reply({ 
                content: `${E_BAN} No tienes acceso a la base de datos de Tránsito.`, 
                ephemeral: true 
            });
        }

        const matriculaBuscada = interaction.options.getString('numero').toUpperCase();

        try {
            // Buscamos en toda la colección de usuarios quien tiene esa matrícula en su array de propiedades
            const snapshot = await db.collection('usuarios_rp').get();
            let propietarioEncontrado = null;
            let datosVehiculo = null;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.propiedades) {
                    const veh = data.propiedades.find(v => v.matricula === matriculaBuscada);
                    if (veh) {
                        propietarioEncontrado = data;
                        datosVehiculo = veh;
                    }
                }
            });

            if (!propietarioEncontrado) {
                return interaction.reply({ 
                    content: `${E_ALERTA} La matrícula **${matriculaBuscada}** no consta en el registro de la Generalitat.`, 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'MINISTERIO DEL INTERIOR - CONTROL DE TRÁNSITO', iconURL: 'https://i.imgur.com/8L8O7vU.png' })
                .setTitle(`${E_POLICIA} Informe de Vehículo: ${matriculaBuscada}`)
                .setColor(0x3498DB)
                .addFields(
                    { name: '🚗 Vehículo', value: datosVehiculo.modelo, inline: true },
                    { name: '🆔 Matrícula', value: datosVehiculo.matricula, inline: true },
                    { name: '📅 Registrado el', value: datosVehiculo.fecha_registro, inline: true },
                    { name: '👤 Titular', value: propietarioEncontrado.nombre, inline: false },
                    { name: '🪪 DNI Titular', value: `#${propietarioEncontrado.numero_dni}`, inline: true },
                    { name: '⭐ Puntos Carnet', value: `${propietarioEncontrado.licencias.conducir.puntos} / 12`, inline: true }
                )
                .setFooter({ text: 'Información obtenida de los servidores de la Generalitat' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `${E_ALERTA} Error al consultar la base de datos vehicular.`, ephemeral: true });
        }
    }
};