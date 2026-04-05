const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vehiculo')
        .setDescription('🚗 Registrar o consultar vehículos del parque automovilístico.'),

    async execute(interaction) {
        const ID_CANAL_VEHICULOS = '1490146016207573062';
        
        if (interaction.channelId !== ID_CANAL_VEHICULOS) {
            return interaction.reply({ 
                content: `❌ Este trámite solo se realiza en la oficina de registro: <#${ID_CANAL_VEHICULOS}>.`, 
                ephemeral: true 
            });
        }

        try {
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ content: "❌ No tienes DNI. Tramita tu identidad primero.", ephemeral: true });
            }

            const data = doc.data();

            // --- VALIDACIÓN DE LICENCIA ---
            if (!data.licencias?.conducir?.estado) {
                return interaction.reply({ 
                    content: "❌ No puedes realizar trámites vehiculares sin un **Permiso de Conducción** vigente.", 
                    ephemeral: true 
                });
            }

            const vehiculosExistentes = data.propiedades || [];

            // --- CASO: TIENE VEHÍCULOS (Elegir A o B) ---
            if (vehiculosExistentes.length > 0) {
                const embedMenu = new EmbedBuilder()
                    .setTitle('🚘 Gestión de Vehículos')
                    .setColor('#f1c40f')
                    .setDescription('Has accedido al sistema de la DGT. ¿Qué trámite deseas realizar?\n\n' +
                                    '🆕 **A: Registrar nuevo vehículo**\n> Tiene un costo de **$10,000**.\n\n' +
                                    '📄 **B: Consultar papeles**\n> Selecciona uno de tus vehículos actuales.');

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_tramite_vehiculo')
                    .setPlaceholder('Selecciona una opción...')
                    .addOptions([
                        {
                            label: 'Registrar Nuevo ($10,000)',
                            value: 'opcion_nuevo',
                            emoji: '🆕',
                            description: 'Inicia el trámite de matriculación.'
                        },
                        ...vehiculosExistentes.map((v, i) => ({
                            label: `${v.modelo}`,
                            value: `ver_${i}`,
                            emoji: '🚗',
                            description: `Matrícula: ${v.matricula}`
                        }))
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                return interaction.reply({ embeds: [embedMenu], components: [row], ephemeral: true });
            }

            // --- CASO: NO TIENE VEHÍCULOS (Abrir modal directo) ---
            return await this.enviarModalRegistro(interaction);

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al conectar con la DGT.", ephemeral: true });
        }
    },

    // Función auxiliar para el modal
    async enviarModalRegistro(interaction) {
        const modal = new ModalBuilder().setCustomId('modal_registro_vehiculo').setTitle('🚗 Registro Nuevo ($10,000)');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_modelo').setLabel("Marca y Modelo").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Seat Ibiza / Audi A3").setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_antiguedad').setLabel("Año del vehículo").setStyle(TextInputStyle.Short).setMaxLength(4).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_color').setLabel("Color principal").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_desc').setLabel("Descripción / Extras").setStyle(TextInputStyle.Paragraph).setPlaceholder("Justifica los 10k de trámite...").setRequired(true))
        );
        return await interaction.showModal(modal);
    },

    async handleVehiculoInteractions(interaction) {
        // --- MANEJO DE SELECCIÓN DEL MENÚ ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_tramite_vehiculo') {
            const valor = interaction.values[0];

            if (valor === 'opcion_nuevo') {
                return await this.enviarModalRegistro(interaction);
            } else {
                // LÓGICA OPCIÓN B: VER PAPELES
                const index = parseInt(valor.split('_')[1]);
                const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
                const doc = await userRef.get();
                const veh = doc.data().propiedades[index];

                const embedPapeles = new EmbedBuilder()
                    .setTitle('📄 Documentación Oficial')
                    .setColor('#2ecc71')
                    .setThumbnail('https://i.imgur.com/2p9p66X.png') // Banner DGT
                    .addFields(
                        { name: '👤 Titular', value: `${interaction.user.username}`, inline: true },
                        { name: '🚗 Modelo', value: `${veh.modelo}`, inline: true },
                        { name: '🆔 Matrícula', value: `**${veh.matricula}**`, inline: true },
                        { name: '📅 Fecha Reg.', value: `${veh.fecha_registro}`, inline: true },
                        { name: '✅ Estado', value: 'Circulación Permitida', inline: false }
                    )
                    .setFooter({ text: 'Anda RP - Registro Automotor' });

                return interaction.reply({ embeds: [embedPapeles], ephemeral: true });
            }
        }

        // --- MANEJO DE SUBMIT DEL MODAL ---
        if (interaction.isModalSubmit()) {
            const { fields, user, guild } = interaction;
            const modelo = fields.getTextInputValue('veh_modelo');
            const año = fields.getTextInputValue('veh_antiguedad');
            const color = fields.getTextInputValue('veh_color');
            const desc = fields.getTextInputValue('veh_desc');
            
            const num = Math.floor(1000 + Math.random() * 9000);
            const letras = "BCDFGHJKLMNPRSTVWXYZ";
            let randomLetras = "";
            for (let i = 0; i < 3; i++) randomLetras += letras.charAt(Math.floor(Math.random() * letras.length));
            const matricula = `${num}-${randomLetras}`;

            const ID_CANAL_REVISION = '1490132369175351397';

            const embedStaff = new EmbedBuilder()
                .setTitle("🚀 Nueva Solicitud de Matriculación ($10k)")
                .setColor('#e67e22')
                .addFields(
                    { name: '👤 Propietario', value: `${user}`, inline: true },
                    { name: '🚗 Vehículo', value: modelo, inline: true },
                    { name: '🆔 Matrícula', value: `**${matricula}**`, inline: true },
                    { name: '📝 Detalles/Pago', value: desc }
                )
                .setTimestamp();

            const botones = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`aprobar_veh_${user.id}_${matricula}_${modelo.replace(/ /g, '-')}`).setLabel('Cobrar 10k y Aprobar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`denegar_veh_${user.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
            );

            const canal = guild.channels.cache.get(ID_CANAL_REVISION);
            if (canal) await canal.send({ embeds: [embedStaff], components: [botones] });

            return interaction.reply({ content: `✅ Solicitud enviada. Si se aprueba, se te descontarán **$10,000** de gastos administrativos.`, ephemeral: true });
        }
    },

    async handleButtons(interaction) {
        const parts = interaction.customId.split('_');
        const accion = parts[0]; 
        const targetId = parts[2];
        const matricula = parts[3];
        const modeloRaw = parts[4];
        
        const docRef = db.collection('usuarios_rp').doc(targetId);
        const targetUser = await interaction.client.users.fetch(targetId);
        const modelo = modeloRaw ? modeloRaw.replace(/-/g, ' ') : "Vehículo";

        if (accion === 'aprobar') {
            const doc = await docRef.get();
            const data = doc.data();
            
            const nuevoVehiculo = {
                matricula: matricula,
                modelo: modelo,
                fecha_registro: new Date().toLocaleDateString('es-ES')
            };

            await docRef.update({
                'propiedades': [...(data.propiedades || []), nuevoVehiculo]
            });

            await interaction.update({ content: `✅ Vehículo aprobado y registrado para <@${targetId}>.`, embeds: [], components: [] });
            try { await targetUser.send(`🚗 **DGT:** Tu vehículo **${modelo}** ha sido aprobado. Se han aplicado los **$10,000** de tasas.`); } catch(e){}
        } else {
            await interaction.update({ content: `❌ Registro denegado.`, embeds: [], components: [] });
            try { await targetUser.send("⚠️ Tu solicitud de registro de vehículo ha sido rechazada."); } catch(e){}
        }
    }
};