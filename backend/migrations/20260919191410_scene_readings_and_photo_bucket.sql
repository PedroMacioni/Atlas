-- Câmera no diário de bordo (RF-16, RF-22).
--
-- `scene` é a leitura automática: a câmera olha a estrada, a IA classifica e
-- só a classe fica — a foto não é guardada (RF-22). É ela que mantém a
-- variável "imagem" do Random Forest atualizada.
--
-- A foto só é guardada em comandos relevantes, como "Registrar ponto
-- turístico" (evento `tourist_spot`), no bucket privado `photos`, lida pela
-- API com a chave de serviço e entregue ao app por URL assinada.
alter table trip_events drop constraint trip_events_kind_check;
alter table trip_events add constraint trip_events_kind_check check (kind in (
  'trip_started', 'trip_ended', 'stop', 'command',
  'recommendation', 'tourist_spot', 'emergency', 'scene'
));

-- Confiança da classificação, como `emotion_confidence` para a voz.
alter table trip_events
  add column image_confidence real check (image_confidence between 0 and 1);

-- Privado, só JPEG, até 5 MB. Sem policy em storage.objects: só a API alcança.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg']);
