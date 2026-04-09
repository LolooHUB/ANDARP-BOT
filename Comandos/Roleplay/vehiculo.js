const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, 
    TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vehiculo')
        .setDescription('🚗 Registrar o consultar vehículos del parque automovilístico.'),

    async execute(interaction) {
        const ID_CANAL_VEHICULOS = '1490146016207573062';
        const RUTA_LOGO = './attachments/LogoPFP.png';
        
        if (interaction.channelId !== ID_CANAL_VEHICULOS) {
            return interaction.reply({ 
                content: `❌ Este trámite solo se realiza en la oficina de registro: <#${ID_CANAL_VEHICULOS}>.`, 
                ephemeral: true 
            });
        }

        try {
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            if (!doc.exists) return interaction.reply({ content: "❌ No tienes DNI.", ephemeral: true });

            const data = doc.data();
            const vehiculosExistentes = data.propiedades || [];
            const esPrimerVehiculo = vehiculosExistentes.length === 0;

            if (!esPrimerVehiculo) {
                // --- BYPASS DE IMAGEN ---
                let logo = null;
                const files = [];
                if (fs.existsSync(RUTA_LOGO)) {
                    logo = new AttachmentBuilder(RUTA_LOGO);
                    files.push(logo);
                }

                const embedMenu = new EmbedBuilder()
                    .setAuthor({ name: 'DGT - GESTIÓN DE VEHÍCULOS', iconURL: logo ? 'attachment://LogoPFP.png' : null })
                    .setTitle('🚘 TRÁMITES DISPONIBLES')
                    .setColor('#f1c40f')
                    .setThumbnail(logo ? 'attachment://LogoPFP.png' : null)
                    .setDescription('**Tarifas Vigentes:**\n👴 Vehículos Clásicos (< 2015): **15,000€**\n✨ Vehículos Modernos (2015+): **22,000€**\n\n' +
                                    '🆕 **Registrar nuevo:** Inicia el trámite de matriculación.\n📄 **Consultar:** Mira los papeles de tus coches actuales.')
                    .setFooter({ text: 'El cobro se realizará al ser aprobado por el Staff.' });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_tramite_vehiculo')
                    .setPlaceholder('Selecciona una opción...')
                    .addOptions([
                        { label: 'Registrar Nuevo Vehículo', value: 'opcion_nuevo', emoji: '🆕' },
                        ...vehiculosExistentes.map((v, i) => ({
                            label: `${v.modelo}`,
                            value: `ver_${i}`,
                            emoji: '🚗',
                            description: `Placa: ${v.matricula}`
                        }))
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                return await interaction.reply({ embeds: [embedMenu], components: [row], files: files, ephemeral: false });
            }

            // Si es el primero, va al modal
            return await this.enviarModalRegistro(interaction, true);

        } catch (error) {
            console.error("Error en Execute Vehiculo:", error);
            if (!interaction.replied) await interaction.reply({ content: "❌ Error de conexión.", ephemeral: true });
        }
    },

    async enviarModalRegistro(interaction, gratis = false) {
        const modal = new ModalBuilder()
            .setCustomId('modal_registro_vehiculo')
            .setTitle(gratis ? '🚗 Primer Registro (GRATIS)' : '🚗 Trámite de Matriculación');
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_modelo').setLabel("Marca y Modelo").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_antiguedad').setLabel("Año del vehículo").setStyle(TextInputStyle.Short).setMaxLength(4).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_color').setLabel("Color principal").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_desc').setLabel("Descripción / Extras").setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return await interaction.showModal(modal);
    },

    async handleVehiculoInteractions(interaction) {
        try {
            if (interaction.isStringSelectMenu() && interaction.customId === 'select_tramite_vehiculo') {
                const valor = interaction.values[0];
                if (valor === 'opcion_nuevo') return await this.enviarModalRegistro(interaction, false);
                
                const index = parseInt(valor.split('_')[1]);
                const doc = await db.collection('usuarios_rp').doc(interaction.user.id).get();
                const veh = doc.data().propiedades[index];

                const embedPapeles = new EmbedBuilder()
                    .setAuthor({ name: 'DOCUMENTACIÓN OFICIAL', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
                    .setColor('#2ecc71')
                    .addFields(
                        { name: '👤 Titular', value: `${interaction.user.username}`, inline: true },
                        { name: '🚗 Modelo', value: `${veh.modelo}`, inline: true },
                        { name: '🆔 Matrícula', value: `\`${veh.matricula}\``, inline: true },
                        { name: '📅 Registro', value: `${veh.fecha_registro}`, inline: true },
                        { name: '🎨 Color', value: `${veh.color || 'No especificado'}`, inline: true }
                    );

                return await interaction.reply({ embeds: [embedPapeles], ephemeral: false });
            }

            if (interaction.isModalSubmit() && interaction.customId === 'modal_registro_vehiculo') {
                await interaction.deferReply({ ephemeral: false }); // Evita el "Interacción fallida" dando más tiempo

                const { fields, user, guild } = interaction;
                const modelo = fields.getTextInputValue('veh_modelo');
                const anio = parseInt(fields.getTextInputValue('veh_antiguedad'));
                const color = fields.getTextInputValue('veh_color');
                const desc = fields.getTextInputValue('veh_desc');
                
                const userRef = db.collection('usuarios_rp').doc(user.id);
                const doc = await userRef.get();
                const data = doc.data();
                const esGratis = (data.propiedades || []).length === 0;

                const precioBase = anio < 2015 ? 15000 : 22000;
                const costoFinal = esGratis ? 0 : precioBase;

                if (!esGratis && (data.banco || 0) < costoFinal) {
                    return await interaction.editReply({ content: `❌ No tienes fondos suficientes (**${costoFinal.toLocaleString()}€**).` });
                }

                const num = Math.floor(1000 + Math.random() * 9000);
                const letras = "BCDFGHJKLMNPRSTVWXYZ";
                let randomLetras = "";
                for (let i = 0; i < 3; i++) randomLetras += letras.charAt(Math.floor(Math.random() * letras.length));
                const matricula = `${num}-${randomLetras}`;

                const embedStaff = new EmbedBuilder()
                    .setTitle(esGratis ? "🎁 Registro GRATIS" : `🚀 Solicitud de Registro (${costoFinal.toLocaleString()}€)`)
                    .setColor(esGratis ? '#2ecc71' : '#e67e22')
                    .addFields(
                        { name: '👤 Usuario', value: `${user}`, inline: true },
                        { name: '🚗 Modelo/Año', value: `${modelo} (${anio})`, inline: true },
                        { name: '🆔 Matrícula Gen.', value: `**${matricula}**`, inline: true },
                        { name: '🎨 Color', value: color, inline: true },
                        { name: '📝 Motivo', value: desc }
                    );

                const botones = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`aprobar_veh_${user.id}_${matricula}_${modelo.replace(/ /g, '-')}_${costoFinal}_${color}`)
                        .setLabel(esGratis ? 'Aprobar Gratis' : `Cobrar ${costoFinal.toLocaleString()}€ y Aprobar`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`denegar_veh_${user.id}`)
                        .setLabel('Denegar').setStyle(ButtonStyle.Danger)
                );

                const canalStaff = guild.channels.cache.get('1490132369175351397');
                if (canalStaff) await canalStaff.send({ embeds: [embedStaff], components: [botones] });

                return await interaction.editReply({ content: `✅ **${user.username}**, solicitud enviada a la DGT.` });
            }
        } catch (e) {
            console.error("Error en handleVehiculoInteractions:", e);
        }
    },

    async handleButtons(interaction) {
        // ... (Tu lógica de botones que ya funcionaba, asegúrate de usar await interaction.update)
        try {
            const parts = interaction.customId.split('_');
            const accion = parts[0]; 
            const targetId = parts[2];

            if (accion === 'denegar') {
                return await interaction.update({ content: `❌ Solicitud denegada por el Staff.`, embeds: [], components: [] });
            }

            if (accion === 'aprobar') {
                const matricula = parts[3];
                const modelo = parts[4].replace(/-/g, ' ');
                const costo = parseInt(parts[5]);
                const color = parts[6];

                const docRef = db.collection('usuarios_rp').doc(targetId);
                const doc = await docRef.get();
                const data = doc.data();

                const nuevoVehiculo = {
                    matricula: matricula,
                    modelo: modelo,
                    color: color,
                    fecha_registro: new Date().toLocaleDateString('es-ES')
                };

                await docRef.update({
                    banco: (data.banco || 0) - costo,
                    propiedades: [...(data.propiedades || []), nuevoVehiculo]
                });

                await interaction.update({ content: `✅ **Aprobado.** Se han cobrado **${costo.toLocaleString()}€** a <@${targetId}>.`, embeds: [], components: [] });
            }
        } catch (e) { console.error(e); }
    }
};