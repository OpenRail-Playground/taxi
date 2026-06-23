import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  DBBrand,
  DBHeader,
  DBIcon,
  DBPage,
  DBSection,
} from '@db-ux/ngx-core-components';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [RouterOutlet, DBPage, DBHeader, DBBrand, DBIcon, DBSection],
})
export class AppComponent {}
