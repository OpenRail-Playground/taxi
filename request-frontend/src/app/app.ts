import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DBPage, DBSection } from '@db-ux/ngx-core-components';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [RouterOutlet, DBPage, DBSection],
})
export class AppComponent {}
