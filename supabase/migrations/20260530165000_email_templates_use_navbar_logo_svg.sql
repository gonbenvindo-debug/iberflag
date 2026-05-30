begin;

update public.email_templates
set html_body = replace(
    replace(
        replace(
            replace(
                html_body,
                $$<p style="margin:0;font-size:26px;line-height:30px;font-weight:700;letter-spacing:.01em;">{{company.name}}</p>$$,
                $$<p style="margin:0;"><img src="{{brand.logo_url}}" alt="{{company.name}}" width="170" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;margin:0 auto;"></p>$$
            ),
            $$<p style="margin:0;font-size:22px;line-height:28px;font-weight:700;">{{company.name}}</p>$$,
            $$<p style="margin:0;"><img src="{{brand.logo_url}}" alt="{{company.name}}" width="170" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;"></p>$$
        ),
        $$<p style="margin:0 0 8px 0;font-size:12px;line-height:18px;color:#6b7280;">IberFlag</p>$$,
        $$<p style="margin:0 0 8px 0;"><img src="{{brand.logo_url}}" alt="{{company.name}}" width="150" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;"></p>$$
    ),
    $$<p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">IberFlag</p>$$,
    $$<p style="margin:0 0 6px 0;"><img src="{{brand.logo_url}}" alt="{{company.name}}" width="150" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;"></p>$$
),
updated_at = now()
where html_body like '%IberFlag%'
   or html_body like '%<p style="margin:0;font-size:26px;line-height:30px;font-weight:700;letter-spacing:.01em;">{{company.name}}</p>%'
   or html_body like '%<p style="margin:0;font-size:22px;line-height:28px;font-weight:700;">{{company.name}}</p>%';

commit;
