do $$
declare
  v_user uuid := gen_random_uuid();
  v_pid bigint;
  v_order public.orders;
  v_result text;
  v_pay_status public.payment_status;
begin
  insert into auth.users (id, email) values (v_user, 'pay-test@quickbite.test');
  select id into v_pid from public.products where slug = 'classic-beef-burger';
  assert v_pid is not null, 'Seed data missing';

  -- Customer places a cash order
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  set local role authenticated;

  select * into v_order from public.create_order(
    p_items => jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1)),
    p_fulfilment => 'collection',
    p_payment_method => 'cash',
    p_customer_name => 'Pay Tester',
    p_customer_phone => '0821234567'
  );

  -- Customers must NOT be able to record payments
  begin
    perform public.apply_payment_result('X', 6500, 'ZAR', true, null);
    raise exception 'FAIL: customer could call apply_payment_result' using errcode = 'XX999';
  exception when insufficient_privilege then null; end;

  -- Online orders are rejected while the switch is off
  begin
    perform public.create_order(
      p_items => jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1)),
      p_fulfilment => 'collection', p_payment_method => 'card_online',
      p_customer_name => 'Pay Tester', p_customer_phone => '0821234567');
    raise exception 'FAIL: card_online accepted while disabled' using errcode = 'XX999';
  exception when raise_exception then null; end;

  -- Simulate two Paystack attempts for the order
  reset role;
  insert into public.payments (order_id, provider, reference, amount, status) values
    (v_order.id, 'paystack', 'QB-TEST-0001', v_order.total, 'pending'),
    (v_order.id, 'paystack', 'QB-TEST-0002', v_order.total, 'pending');

  -- The trusted role processes results
  set local role service_role;

  begin
    perform public.apply_payment_result('NOPE-NOPE', 6500, 'ZAR', true, null);
    raise exception 'FAIL: unknown reference accepted' using errcode = 'XX999';
  exception when no_data_found then null; end;

  v_result := public.apply_payment_result('QB-TEST-0001', 1, 'ZAR', true, null);
  assert v_result = 'mismatch', 'wrong amount must be rejected, got ' || v_result;

  v_result := public.apply_payment_result('QB-TEST-0001', 6500, 'USD', true, null);
  assert v_result = 'mismatch', 'wrong currency must be rejected, got ' || v_result;

  reset role;
  select payment_status into v_pay_status from public.orders where id = v_order.id;
  assert v_pay_status <> 'paid', 'mismatched payment must not mark the order paid';

  set local role service_role;
  v_result := public.apply_payment_result('QB-TEST-0001', 6500, 'ZAR', true, null);
  assert v_result = 'paid', 'correct payment should be accepted, got ' || v_result;

  v_result := public.apply_payment_result('QB-TEST-0001', 6500, 'ZAR', true, null);
  assert v_result = 'already_paid', 'repeat must be idempotent, got ' || v_result;

  v_result := public.apply_payment_result('QB-TEST-0002', 6500, 'ZAR', true, null);
  assert v_result = 'duplicate_payment', 'second charge must be flagged, got ' || v_result;

  reset role;
  select payment_status into v_pay_status from public.orders where id = v_order.id;
  assert v_pay_status = 'paid', 'order should now be paid';

  raise exception 'ALL PAYMENT TESTS PASSED (all test data rolled back)' using errcode = 'XX000';
end;
$$;