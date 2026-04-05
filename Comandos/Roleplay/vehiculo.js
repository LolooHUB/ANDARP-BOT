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
        .setName('vehiculo')
        .setDescription('🚗 Registrar un vehículo en el parque automovilístico.'),

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
            if (!data.licencias.conducir.estado) {
                return interaction.reply({ 
                    content: "❌ No puedes registrar un vehículo sin poseer un **Permiso de Conducción** vigente.", 
                    ephemeral: true 
                });
            }

            // --- MODAL DE REGISTRO ---
            const modal = new ModalBuilder().setCustomId('modal_registro_vehiculo').setTitle('🚗 Registro de Vehículo');
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_modelo').setLabel("Marca y Modelo").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Seat Ibiza / Audi A3").setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_antiguedad').setLabel("Año del vehículo").setStyle(TextInputStyle.Short).setMaxLength(4).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_color').setLabel("Color principal").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('veh_desc').setLabel("Descripción / Extras").setStyle(TextInputStyle.Paragraph).setPlaceholder("Ej: Llantas negras, alerón deportivo...").setRequired(true))
            );

            return await interaction.showModal(modal);

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al conectar con la DGT.", ephemeral: true });
        }
    },

    async handleVehiculoInteractions(interaction) {
        const { fields, user, guild } = interaction;
        const modelo = fields.getTextInputValue('veh_modelo');
        const año = fields.getTextInputValue('veh_antiguedad');
        const color = fields.getTextInputValue('veh_color');
        const desc = fields.getTextInputValue('veh_desc');
        
        // Generador de matrícula formato Español (0000 BBB)
        const num = Math.floor(1000 + Math.random() * 9000);
        const letras = "BCDFGHJKLMNPRSTVWXYZ";
        let randomLetras = "";
        for (let i = 0; i < 3; i++) randomLetras += letras.charAt(Math.floor(Math.random() * letras.length));
        const matricula = `${num}-${randomLetras}`;

        const ID_CANAL_REVISION = '1490132369175351397';

        const embedStaff = new EmbedBuilder()
            .setTitle("📄 Solicitud de Matriculación")
            .setColor(0x3498DB)
            .addFields(
                { name: '👤 Propietario', value: `${user}`, inline: true },
                { name: '🚗 Vehículo', value: modelo, inline: true },
                { name: '📅 Año', value: año, inline: true },
                { name: '🎨 Color', value: color, inline: true },
                { name: '🆔 Matrícula Generada', value: `**${matricula}**`, inline: true },
                { name: '📝 Detalles', value: desc }
            )
            .setFooter({ text: 'Revisión técnica necesaria' })
            .setTimestamp();

        const botones = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprobar_veh_${user.id}_${matricula}_${modelo.replace(/ /g, '-')}`).setLabel('Aprobar Registro').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`denegar_veh_${user.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
        );

        const canal = guild.channels.cache.get(ID_CANAL_REVISION);
        if (canal) await canal.send({ content: '🔔 **Nueva solicitud de vehículo**', embeds: [embedStaff], components: [botones] });

        return interaction.reply({ content: `✅ Solicitud enviada. Matrícula asignada provisionalmente: **${matricula}**. Espera la aprobación del Staff.`, ephemeral: true });
    },

    async handleButtons(interaction) {
        const [accion, , targetId, matricula, modeloRaw] = interaction.customId.split('_');
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

            await interaction.update({ content: `✅ Vehículo **${modelo}** [${matricula}] aprobado para <@${targetId}>.`, embeds: [], components: [] });
            try { await targetUser.send(`🚗 **Registro Civil:** Tu vehículo **${modelo}** con matrícula **${matricula}** ha sido aprobado y registrado a tu nombre.`); } catch(e){}
        } else {
            await interaction.update({ content: `❌ Registro de vehículo denegado.`, embeds: [], components: [] });
            try { await targetUser.send("⚠️ Tu solicitud de registro de vehículo ha sido rechazada por el Staff."); } catch(e){}
        }
    }
};